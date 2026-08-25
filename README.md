# Nanyang

เว็บรวม Dashboard ของ Nanyang ในจุดเดียว โดยมีแท็บสลับระหว่าง **VVIC** และ **EASY LEAN**

## Applications

- `apps/vvic` → source จาก `Nunthaporn/VVIC`
- `apps/easy-lean` → source จาก `Nunthaporn/easy-lean-dashboard`
- `portal/index.html` → หน้าเว็บหลักสำหรับสลับ Dashboard แบบแท็บ

## Clone

```bash
git clone --recurse-submodules https://github.com/Nunthaporn/Nanyang.git
cd Nanyang
```

ถ้า clone ไปแล้วแต่ยังไม่ได้โหลด submodule:

```bash
git submodule update --init --recursive
```

## Run

เปิด 3 terminal

### 1. VVIC frontend

```bash
cd apps/vvic/frontend
npm install
npm run dev
```

VVIC ใช้ `http://localhost:5173`

### 2. Easy Lean frontend

```bash
cd apps/easy-lean/frontend
npm install
npm run dev
```

Easy Lean ใช้ `http://localhost:5174`

### 3. Portal

จาก root ของ Nanyang:

```bash
python -m http.server 5500 -d portal
```

เปิด `http://localhost:5500`

จากนั้นสามารถกดแท็บ **VVIC** หรือ **EASY LEAN** เพื่อสลับ Dashboard ได้จากหน้าเดียว

## Backend

Backend เดิมยังถูกเก็บแยกตามแต่ละ application เพื่อไม่ให้ logic/API ที่ใช้งานอยู่เสียหาย ในขั้นถัดไปสามารถรวม FastAPI ให้เป็น service เดียวและจัด endpoint เป็น `/api/vvic/*` กับ `/api/easy-lean/*` ได้
