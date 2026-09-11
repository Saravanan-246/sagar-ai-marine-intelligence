@echo off
REM Sagar AI Backend — Windows startup script
REM Run from: backend/

echo [Sagar AI] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [Sagar AI] Installing / verifying dependencies...
pip install -r requirements.txt --quiet

echo [Sagar AI] Seeding database...
python seed.py

echo [Sagar AI] Starting FastAPI server on http://127.0.0.1:8000
echo [Sagar AI] API docs: http://127.0.0.1:8000/api/docs
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
