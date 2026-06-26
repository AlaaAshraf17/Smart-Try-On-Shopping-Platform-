# Smart Try-On Shopping Platform - Backend

An advanced e-commerce REST API built with Node.js and Express, featuring a 3D digital asset pipeline (.glb models) for virtual garment fittings and an integrated generative AI assistant engine.

---

## Architectural Features

### Authentication & Identity Security
- **Stateless Session Management:** User registration, login, and profile access tracking via JSON Web Tokens (JWT).
- **Cryptographic Hashing:** One-way data security for user passwords using `bcryptjs` salting algorithms.
- **Automated Account Recovery:** Secure password bypass mechanism utilizing a background Nodemailer SMTP transporter layer with embedded TLS validation overrides.

### E-Commerce Management Engine
- **Product & Inventory Schema:** Dynamic management of product collections, pricing matrix structures, count-in-stock thresholds, and categorized items.
- **Transactional Logic:** Processing cart mutations, active checking of product stock balances, and final order generation.

### Virtual Try-On Engine Pipeline (AI & 3D)
- **Image-to-Image Garment Fitting:** Integrated hooks for orchestrating AI image-processing layers (IDM-VTON deep learning model architecture) to overlay clothing items onto custom user profile portraits.
- **3D Asset Delivery Pipeline:** Scalable processing, automated folder allocation, and direct serving of binary 3D meshes (`.glb` models) utilizing Cloudinary's raw storage resource engine for low-latency interactive viewing.
- **AI Stylist integration:** Conversational contextual chat streaming endpoints powered by the `@google/genai` model ecosystem.

### Testing & Live Documentation
- **Interactive API Explorer:** Automated generation of live OpenAPI testing catalogs utilizing an embedded Swagger router middleware dashboard.
- **Integration Test Suite:** Complete end-to-end endpoint and schema logic validations written using Jest and Supertest.

---

## Tech Stack

- **Runtime Environment:** Node.js
- **Framework Core:** Express.js
- **Database Engine:** MongoDB with Mongoose Object Data Modeling (ODM)
- **Object Storage System:** Cloudinary API SDK
- **Mailing Handshake Client:** Nodemailer
- **Testing Cluster:** Jest & Supertest
- **API Documentation:** Swagger (OpenAPI 3.0)

---

## Installation

1. Clone the repository
2. Navigate to the Backend Folder:
   ```bash
   cd Back-end
3. Install dependencies:
   ```bash
   npm install
4. Configure Environmental Secret Keys, 
   Create a file named .env in the root of your Back-end/ directory and configure the following infrastructure keys exactly as shown in the .env.example
5. Launch the Development Server:
   ```bash
   npm run dev
6. Execute Test Suite
   To run the automated endpoint validation workflows:
   ```bash
   npm test