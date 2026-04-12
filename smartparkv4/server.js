const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("smartpark.db");

const today = () => new Date().toISOString().split("T")[0];
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

// DB INIT
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    occupied INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot TEXT,
    user TEXT,
    date TEXT
  )`);

  ["A1","A2","A3","A4"].forEach(s=>{
    db.run("INSERT OR IGNORE INTO slots VALUES (?,?)",[s,0]);
  });
});

// ---------- AUTH ----------
app.post("/signup",(req,res)=>{
  const {username,password} = req.body;
  db.run(
    "INSERT INTO users VALUES (NULL,?,?)",
    [username,password],
    err=>{
      if(err) return res.json({success:false,message:"Username already exists"});
      res.json({success:true,message:"Signup successful"});
    }
  );
});

app.post("/login",(req,res)=>{
  const {username,password} = req.body;
  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username,password],
    (e,row)=>{
      if(row) res.json({success:true,message:"Login successful"});
      else res.json({success:false,message:"Invalid credentials"});
    }
  );
});

// ---------- ESP32 ----------
app.post("/update",(req,res)=>{
  const {slot,occupied} = req.body;
  db.run("UPDATE slots SET occupied=? WHERE id=?",[occupied?1:0,slot]);
  res.json({ok:true});
});

// bookings for TODAY only → LED logic
app.get("/bookings",(req,res)=>{
  db.all(
    "SELECT slot FROM bookings WHERE date=?",
    [today()],
    (e,rows)=>{
      const out = {A1:0,A2:0,A3:0,A4:0};
      rows.forEach(r=>out[r.slot]=1);
      res.json(out);
    }
  );
});

// ---------- FRONTEND ----------
app.get("/status",(req,res)=>{
  db.all("SELECT * FROM slots",(e,slots)=>{
    db.all(
      "SELECT slot, date FROM bookings",
      (e2,bookings)=>{
        res.json({slots,bookings});
      }
    );
  });
});

app.post("/book",(req,res)=>{
  const {slot,user,date} = req.body;

  if(!["A1","A2"].includes(slot))
    return res.json({success:false,message:"Invalid slot"});

  if(![today(),tomorrow()].includes(date))
    return res.json({success:false,message:"Invalid date"});

  db.get(
    "SELECT * FROM bookings WHERE slot=? AND date=?",
    [slot,date],
    (e,row)=>{
      if(row) return res.json({success:false,message:"Already booked"});
      db.run(
        "INSERT INTO bookings (slot,user,date) VALUES (?,?,?)",
        [slot,user,date],
        ()=>res.json({success:true,message:"Booking confirmed"})
      );
    }
  );
});

app.post("/cancel",(req,res)=>{
  const {slot,user,date} = req.body;
  db.run(
    "DELETE FROM bookings WHERE slot=? AND user=? AND date=?",
    [slot,user,date],
    function(){
      res.json({success:this.changes===1});
    }
  );
});

app.get("/mybookings/:user",(req,res)=>{
  db.all(
    "SELECT * FROM bookings WHERE user=?",
    [req.params.user],
    (e,rows)=>res.json(rows)
  );
});

app.listen(3000, "0.0.0.0", ()=>console.log("SmartPark backend running"));
