const mongoose = require('mongoose');

mongoose.connect("mongodb://127.0.0.1:27017/pinspire")

const postSchema = mongoose.Schema({

    user:{
        type: mongoose.Schema.Types.ObjectId , 
        ref : "user"
    },

    date : {
        type : Date , 
        default : Date.now()
    }, 

    content : String 

    

});

module.exports = mongoose.model('post', postSchema); 