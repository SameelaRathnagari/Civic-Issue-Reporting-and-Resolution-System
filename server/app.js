const express = require("express");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const db = require("./db");
const fs = require("fs");
require("dotenv").config(); // ✅ added

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

const SECRET = process.env.SECRET || "secret123"; // ✅ changed

// ================= UPLOAD =================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
    destination: (req,file,cb)=>cb(null,"uploads/"),
    filename: (req,file,cb)=>cb(null,Date.now()+"-"+file.originalname)
});
const upload = multer({storage});

// ================= REGISTER =================
app.post("/register",(req,res)=>{

const {username,password,email,phone,dob,address} = req.body;

if(!username || !password){
return res.send("Missing data");
}

db.query(
"SELECT * FROM users WHERE username=?",
[username],
(err,result)=>{

if(result.length>0){
return res.send("User already exists");
}

db.query(
"INSERT INTO users(username,password,email,phone,dob,address,role) VALUES(?,?,?,?,?,?,?)",
[username,password,email,phone,dob,address,"USER"],
()=>res.send("Registered")
);

}
);

});

// ================= LOGIN =================
app.post("/login",(req,res)=>{

const username = (req.body.username || "").trim();
const password = (req.body.password || "").trim();

if(!username || !password){
return res.send("Missing data");
}

db.query(
"SELECT * FROM users WHERE username=? LIMIT 1",
[username],
(err,result)=>{

if(err) return res.send("Error");

if(result.length===0){
return res.send("Invalid");
}

if(password !== result[0].password){
return res.send("Invalid");
}

const token = jwt.sign({
user:username,
role:result[0].role
},SECRET);

res.send(token);

}
);

});

// ================= VERIFY =================
function verify(req,res,next){

const token = req.headers["authorization"];

if(!token) return res.send("No token");

jwt.verify(token,SECRET,(err,decoded)=>{
if(err) return res.send("Invalid token");
req.user = decoded;
next();
});
}

// ================= ADD COMPLAINT =================
app.post("/add",verify,upload.single("file"),(req,res)=>{

const {title,desc,category,location} = req.body;

let priority = 1;

const text = (title + " " + desc).toLowerCase();

if(text.includes("accident") || text.includes("danger")){
priority = 5;
}
else if(category.includes("Road")){
priority = 3;
}
else if(category.includes("Garbage")){
priority = 2;
}

db.query(
"SELECT * FROM complaints WHERE location=? AND category=?",
[location,category],
(err,result)=>{

if(result.length>0){
db.query(
"UPDATE complaints SET priority=priority+1 WHERE id=?",
[result[0].id]
);
return res.send("Duplicate → priority increased");
}

db.query(
"INSERT INTO complaints(title,description,category,location,status,priority,image,user) VALUES(?,?,?,?,?,?,?,?)",
[
title,
desc,
category,
location,
"PENDING",
priority,
req.file?.filename,
req.user.user
],
()=>{

db.query(
"INSERT INTO complaint_logs(complaint_id,status) VALUES(LAST_INSERT_ID(),'PENDING')"
);

res.send("Added");

}
);

}
);

});

// ================= GET ALL =================
app.get("/all", verify, (req, res) => {

let query = "";
let values = [];

if(req.user.role === "ADMIN"){
query = "SELECT * FROM complaints ORDER BY id DESC";
}
else{
query = "SELECT * FROM complaints WHERE user=? ORDER BY id DESC";
values = [req.user.user];
}

db.query(query, values, (err, result) => {

const data = result.map(c => {

let mapLink = "";

if(c.location){
const parts = c.location.split(",");
if(parts.length === 2){
mapLink = `https://www.google.com/maps?q=${parts[0]},${parts[1]}`;
}
}

return {
...c,
mapLink
};
});

res.send(data);
});
});

// ================= EDIT =================
app.put("/edit/:id", verify, (req, res) => {

const { title, desc, category, location } = req.body;

db.query(
"UPDATE complaints SET title=?, description=?, category=?, location=? WHERE id=? AND user=?",
[title, desc, category, location, req.params.id, req.user.user],
(err, result) => {

if(err) return res.send("Error");

if(result.affectedRows === 0){
return res.send("Not allowed");
}

res.send("Updated");

}
);

});

// ================= DELETE =================
app.delete("/delete/:id", verify, (req,res)=>{

db.query(
"DELETE FROM complaints WHERE id=? AND user=?",
[req.params.id, req.user.user],
(err)=>{
if(err) return res.send("Error");
res.send("Deleted");
}
);

});

// ================= STATUS =================
app.put("/status/:id", verify, (req,res)=>{

if(req.user.role !== "ADMIN") return res.send("Access denied");

const status = req.query.status;

db.query(
"UPDATE complaints SET status=? WHERE id=?",
[status, req.params.id],
()=>{

db.query(
"INSERT INTO complaint_logs(complaint_id,status) VALUES(?,?)",
[req.params.id, status]
);

res.send("Updated");

}
);

});

// ================= LOGS =================
app.get("/logs/:id", verify, (req,res)=>{

db.query(
"SELECT * FROM complaint_logs WHERE complaint_id=? ORDER BY updated_at ASC",
[req.params.id],
(err,result)=>{
res.send(result);
}
);

});

// ✅ FIXED PORT FOR DEPLOYMENT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port " + PORT));