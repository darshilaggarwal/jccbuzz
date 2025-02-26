const mongoose = require('mongoose');

mongoose.connect("mongodb://127.0.0.1:27017/pinspire")

const userSchema = mongoose.Schema({
    name : String ,
    username: String,
    password: String,
    email: String , 
    password : String , 
    posts : [
       { type : mongoose.Schema.Types.ObjectId  ,
        ref: "post"
       }
    ]
});

module.exports = mongoose.model('User', userSchema); 