# Nanyang Unified App

Branch นี้รวม VVIC และ EASY LEAN ให้ใช้ Frontend เดียวและ Backend เดียว โดยยังใช้ source เดิมใน `apps/` เป็น module เพื่อหลีกเลี่ยงการทำ logic เดิมเสียหาย

## Architecture

- Frontend: `frontend/` → Vite/React ที่ port `5173`
- Backend: `backend/` → FastAPI ที่ port `8001`
- VVIC API: `/api/dashboard/*`
- Easy Lean API: `/api/easylean/*`

## Run

หลัง checkout branch ให้ sync submodule ก่อน:

```powershell
git submodule update --init --recursive
```

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

### Frontend

เปิด Terminal ใหม่:

```powershell
cd frontend
npm install
npm run dev
```

เปิด:

`http://localhost:5173`

ด้านบนจะมีแท็บ `VVIC` และ `EASY LEAN` โดยไม่ใช้ iframe และไม่ต้องเปิด Portal port 5500

## Build

```powershell
cd frontend
npm run build
```

เมื่อมี `frontend/dist` แล้ว FastAPI สามารถ serve production build ได้ด้วย
