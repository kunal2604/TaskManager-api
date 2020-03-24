// This file will handle connection logic to the Mongodb database
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/TaskManager', 
        { useNewUrlParser: true , useUnifiedTopology: true, useFindAndModify: false } 
    ).then(() => {
    console.log("Connected to MongoDB successfully :)");
}).catch((e) => {
    console.log("Error while connecting to MongoDB");
    console.log(e);
})

// To prevent deprecation warning (from MongoDB native driver)
// mongoose.set('useCreateIndex', true);
// mongoose.set('useFindAndMofify', false);

module.exports = {
    mongoose
};