# 🧠 AI Resume Backend

The backend API for Resume Analyzer that processes resumes, extracts skills, and generates ATS scores using AI.

![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=flat-square) ![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 🚀 Live API

- **Production**: https://ai-resume-backend-new.vercel.app
- **Frontend Repo**: https://github.com/yourusername/Resume-Analyzer

---

## ✨ Features

- 📄 **PDF Processing** - Parse and extract text from resumes
- 🧠 **AI Analysis** - Cerebras LLM for intelligent skill extraction
- 📊 **ATS Scoring** - Generate 0-100 scores with normalization
- 🔍 **Skill Extraction** - Identify matching and missing skills
- 💡 **Smart Suggestions** - Generate improvement recommendations
- 🔐 **CORS Enabled** - Secure API access for frontend
- ⚡ **Fast Inference** - Optimized AI responses
- 📡 **Scalable** - MongoDB Atlas for data persistence

---

## 📸 API Response Example


<img width="1134" height="878" alt="Screenshot 2026-01-26 002252" src="https://github.com/user-attachments/assets/f49ee5f6-e886-4067-8233-0d0f9617fbfb" />


*Sample JSON response showing ATS score, extracted skills, missing skills, and improvement suggestions.*

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **PDF Parsing**: pdf-parse
- **LLM**: Cerebras AI API
- **Database**: MongoDB Atlas
- **File Upload**: Multer
- **Hosting**: Vercel

---

## 📦 Installation

### Prerequisites
- Node.js 16+
- npm or yarn
- MongoDB Atlas account
- Cerebras API key

### 1️⃣ Clone Repository

```bash
git clone https://github.com/Agamdeep555/AI_Resume_backend.git
cd AI_Resume_backend
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Environment Variables

Create `.env` file:

```env
CEREBRAS_API_KEY=your_cerebras_api_key
MONGODB_URI=your_mongodb_connection_string
PORT=5000
FRONTEND_URL=http://localhost:5173
```

### 4️⃣ Start Server

```bash
npm run dev
```

Server runs at: `http://localhost:5000`

---

## 📁 Project Structure

```
src/
├── routes/
│   └── resume.js          # Resume analysis routes
├── controllers/
│   └── resumeController.js # Analysis logic
├── middleware/
│   └── upload.js          # File upload handling
├── utils/
│   └── parser.js          # PDF text extraction
├── index.js               # Server entry point
└── .env                   # Environment variables
```

---

## 📡 API Endpoints

### Analyze Resume

```
POST /api/resume/analyze
```

**Request:**
```
Content-Type: multipart/form-data

Body:
- resume (file): PDF resume
- targetRole (string): Job position
```

**Response:**
```json
{
  "ats_score": 85,
  "skills_found": ["React", "Node.js", "MongoDB"],
  "missing_skills": ["Docker", "Kubernetes"],
  "improvement_suggestions": [
    "Add quantifiable metrics",
    "Include leadership examples"
  ]
}
```

**Error Response:**
```json
{
  "message": "File validation failed",
  "status": 400
}
```

---

## 🔧 Key Functions

### PDF Text Extraction
Parses PDF resume and extracts readable text for AI analysis.

### AI Skill Analysis
Uses Cerebras LLM to:
- Extract key skills from resume
- Match against job description
- Identify skill gaps
- Generate improvement tips

### ATS Score Calculation
- Normalizes AI output to 0-100 scale
- Validates response format
- Handles edge cases gracefully

---

## 🔐 Security

- ✅ File type validation (PDF only)
- ✅ File size limit (10MB)
- ✅ CORS policy enforcement
- ✅ Input sanitization
- ✅ Error message filtering
- ✅ API key protection
- ✅ Rate limiting ready

---

## 🚀 Deployment (Vercel)

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

### 2. Connect to Vercel
- Go to vercel.com
- Import GitHub repository
- Add environment variables

### 3. Set Environment Variables

In Vercel dashboard:
```
CEREBRAS_API_KEY = your_key
MONGODB_URI = your_mongodb_url
FRONTEND_URL = https://your-frontend.vercel.app
```

### 4. Deploy
```bash
vercel deploy --prod
```

---

## 🧪 Testing

### Local Testing with cURL

```bash
curl -X POST http://localhost:5000/api/resume/analyze \
  -F "resume=@resume.pdf" \
  -F "targetRole=Software Engineer"
```

### Using Postman
1. Create POST request to `/api/resume/analyze`
2. Body → form-data
3. Add file and targetRole fields
4. Send request

---

## 📊 Response Format

### Normalized Score
If AI returns decimal (0.85), multiply by 100 = 85

### Skill Extraction
- Returns array of matched keywords
- Case-insensitive matching
- Removes duplicates

### Suggestions
- 3-5 actionable improvements
- Role-specific recommendations
- Formatting tips included

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| PDF parsing fails | Check file format and size |
| API key error | Verify CEREBRAS_API_KEY in .env |
| CORS blocked | Check FRONTEND_URL config |
| MongoDB connection error | Test connection string |
| Timeout errors | Check file size (max 10MB) |

---

## 📈 Performance

- **Response Time**: 2-4 seconds per analysis
- **Concurrent Requests**: 100+ per minute
- **Uptime**: 99.9% (Vercel SLA)
- **Max File Size**: 10MB PDF

---

## 🔮 Future Enhancements

- [ ] Resume history storage
- [ ] Batch processing
- [ ] Advanced analytics dashboard
- [ ] Custom scoring models
- [ ] Resume template suggestions
- [ ] Grammar checking integration
- [ ] LinkedIn profile parsing

---

## 📄 License

MIT License

---

## 🔗 Links

- **Frontend Repo**: https://github.com/yourusername/Resume-Analyzer
- **Live Frontend**: https://ai-resume-frontend-snowy.vercel.app
- **Backend Live**: https://ai-resume-backend-new.vercel.app
- **Cerebras Docs**: https://docs.cerebras.ai

---

## 📸 API Response Example

![Resume Analysis JSON Response](https://github.com/user-attachments/assets/bbcc7b99-b6ec-4ab9-a5ca-bb523e6e888a)

*Sample JSON response showing ATS score, extracted skills, missing skills, and improvement suggestions exported by frontend.*

**Agamdeep Singh**
- GitHub: [@Agamdeep555](https://github.com/Agamdeep555)
- LinkedIn: [Agamdeep Singh](https://www.linkedin.com/in/agamdeep-singh-9b87912b2/)

---

**Made with ❤️ by Agam** | Powering AI-driven resume analysis 🚀
