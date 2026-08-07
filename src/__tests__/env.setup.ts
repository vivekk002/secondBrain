// Runs before the test framework and any test file imports, so every
// module-level `process.env.X!` read (e.g. JWT_SECRET in middleware/index.ts)
// sees a value. These are dummy values - tests mock out the AI/Cloudinary
// SDKs rather than hitting real external services.
process.env.JWT_SECRET = "test-jwt-secret";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.GROQ_API_KEY = "test-groq-key";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-cloudinary-key";
process.env.CLOUDINARY_API_SECRET = "test-cloudinary-secret";
process.env.CONVERTAPI_SECRET = "test-convertapi-secret";
process.env.FRONTEND_URL = "http://localhost:5173";
