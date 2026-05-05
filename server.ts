import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Necessário para atualizar status via server sem bypassar RLS
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Criar Pedido Pagar.me
  app.post("/api/pagarme/create-order", async (req, res) => {
    try {
      const { amount, customer, items, metadata } = req.body;
      const secretKey = process.env.PAGARME_SECRET_KEY;

      if (!secretKey) {
        return res.status(500).json({ error: "Pagar.me secret key not configured" });
      }

      const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;

      // Payload para Pagar.me v5 - Build Robusta
      const payload = {
        items: items.map((item: any) => ({
          amount: Math.max(100, Math.round(Number(item.amount))), 
          description: String(item.description || "Inscrição").substring(0, 250),
          quantity: 1,
          code: String(item.code || "REGISTRO").substring(0, 50)
        })),
        customer: {
          name: (customer.name || "Participante").substring(0, 64),
          email: customer.email,
          type: "individual",
          document: String(customer.cpf || "").replace(/\D/g, '') || "00000000000",
          document_type: "CPF",
          phones: {
            mobile_phone: {
              country_code: "55",
              area_code: "11",
              number: "999999999"
            }
          }
        },
        payments: [
          {
            payment_method: "checkout",
            checkout: {
              expires_in: 120,
              billing_address_editable: true,
              customer_editable: true,
              accepted_payment_methods: ["credit_card", "pix"],
              pix: {
                expires_in: 3600
              },
              success_url: metadata.success_url,
              skip_checkout_success_page: false
            }
          }
        ],
        metadata: {
          ...metadata,
          server_version: "1.4"
        }
      };

      const response = await fetch("https://api.pagar.me/core/v5/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(payload)
      });

      const order = await response.json();
      
      if (!response.ok) {
        console.error("Pagar.me API Error RAW:", JSON.stringify(order, null, 2));
        return res.status(response.status).json({ message: order.message || "Erro de validação", details: order });
      }

      res.json({
        order_id: order.id,
        checkout_url: order.checkouts?.[0]?.payment_url
      });
    } catch (error: any) {
      console.error("Create Order Runtime Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Tokenizar CC (Prototipagem - NÃO USAR EM PRODUÇÃO)
  app.post("/api/pagarme/tokenize", async (req, res) => {
    try {
      const { card } = req.body;
      const secretKey = process.env.PAGARME_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "Secret key missing" });
      
      const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
      
      const response = await fetch("https://api.pagar.me/core/v5/tokens?appId=v5", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify({ type: "card", card })
      });
      
      const result = await response.json();
      if (!response.ok) return res.status(response.status).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // API: Criar Pedido com CC (Transparent)
  app.post("/api/pagarme/create-cc-order", async (req, res) => {
    try {
      const { amount, customer, items, metadata, card_token } = req.body;
      const secretKey = process.env.PAGARME_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "Secret key missing" });
      
      const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
      
      const payload = {
        items: items.map((item: any) => ({
          amount: Math.max(100, Math.round(Number(item.amount))),
          description: String(item.description || "Inscrição").substring(0, 250),
          quantity: 1,
          code: String(item.code || "REGISTRO").substring(0, 50)
        })),
        customer: {
          name: (customer.name || "Participante").substring(0, 64),
          email: customer.email,
          type: "individual",
          document: String(customer.cpf || "").replace(/\D/g, '') || "00000000000",
          document_type: "CPF"
        },
        payments: [{
          payment_method: "credit_card",
          credit_card: {
            installments: 1,
            card: {
              token: card_token
            }
          }
        }],
        metadata
      };
      
      const response = await fetch("https://api.pagar.me/core/v5/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      if (!response.ok) return res.status(response.status).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // API: Webhook Pagar.me
  app.post("/api/pagarme/webhook", async (req, res) => {
    try {
      const event = req.body;
      console.log("Webhook received:", event.type);

      if (event.type === "order.paid") {
        const order = event.data;
        const { type, participant_id } = order.metadata;

        let table = type === 'curso' ? 'curso_participantes' : 'modulo_participantes';
        
        const { error } = await supabase
          .from(table)
          .update({ status: 'pago' })
          .eq('id', participant_id);

        if (error) {
          console.error(`Error updating status for ${participant_id}:`, error);
          return res.status(500).send("Database update failed");
        }
      }

      res.status(200).send("Webhook received");
    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).send(error.message);
    }
  });

  const distPath = path.resolve(__dirname, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
