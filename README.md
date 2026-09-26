# OpportunityOS Backend (Phase 1)

OpportunityOS backend service foundation built with FastAPI.

---

## Prerequisites

- Python 3.10+ installed on your system.

---

## Getting Started

### 1. Create a Python Virtual Environment

Open your terminal in the project root directory (`opportunity os`) and run:

```bash
python -m venv .venv
```

### 2. Activate the Virtual Environment (Windows)

In PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```

Or in Command Prompt (CMD):
```cmd
.venv\Scripts\activate.bat
```

### 3. Install Dependencies

Upgrade pip and install the required packages:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Environment Configuration (Optional)

Copy the placeholder `.env.example` to `.env` if custom configurations are needed:

```bash
copy .env.example .env
```

Defaults are safely configured for local development.

### 5. Start FastAPI using Uvicorn

Run the development server with live reload:

```bash
uvicorn app.main:app --reload
```

Or using python module invocation:

```bash
python -m uvicorn app.main:app --reload
```

### 6. Local API Addresses

- **API Base Address**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative API Docs (ReDoc)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 7. Expected Endpoints

#### Root Endpoint (`GET /`)
- **URL**: `http://127.0.0.1:8000/`
- **Response**:
  ```json
  {
    "name": "OpportunityOS API",
    "status": "running"
  }
  ```

#### Health Endpoint (`GET /health`)
- **URL**: `http://127.0.0.1:8000/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "opportunityos-backend"
  }
  ```

---

## Running Tests

Execute test suite using `pytest`:

```bash
pytest
```

Or using python module invocation:

```bash
python -m pytest
```

