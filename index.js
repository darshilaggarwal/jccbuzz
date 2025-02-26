const express = require("express");
const app = express();
const userModel = require("./models/user");  
const postModel = require("./models/post")
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
 
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());



app.get("/" , (req,res)=>{
    res.render("landing")
})

app.get("/login" , (req,res)=>{
    res.render("login")
})

app.get("/register" , (req,res)=>{
    res.render("register")
})

app.post("/register" ,async (req,res)=>{

    let { email , username , name , password } = req.body
 
     let user = await userModel.findOne({email})
     if (user) return res.status(500).send("user registered")

        bcrypt.genSalt(10 , (err, salt)=>{
            bcrypt.hash(password , salt , async  (err, hash) => {
              let user =  await userModel.create({
                    name , 
                    email , 
                    username , 
                    password : hash
                });

                let token = jwt.sign({email:email , userid:user._id} , "shhhh");
                res.cookie("token" , token);
                res.send("user is registered now")
                
                
                
            })
        })
})

app.post("/login")
 
app.listen(3000);