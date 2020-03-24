const express = require('express');
const app = express();
const { mongoose } = require('./db/mongoose');

const PORT = process.env.PORT || 3000;
// Load mongoose models
const { List, Task } = require('./db/models'); //index.js is by default selected

// Load middleware
app.use(express.json());

// CORS Header Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Methods", "GET,POST,HEAD,OPTIONS,DELETE,PUT,PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");       
    next();
});

// app.get('/', (req,res) => {
//     res.send('Hello world!');
// })
// Get Lists
app.get('/lists', (req, res) => {
    List.find()
        .then(lists => { res.send(lists); })
        .catch(e => { res.send(e); });
});

// Get Particular List
app.get('/lists/:listId', (req, res) => {
    List.find({_id: req.params.listId})
        .then(list => { res.send(list); })
        .catch(e => { res.send(e); });
});

// Add List
app.post('/lists', (req, res) => {
    let title = req.body.title;
    let newList = new List({
        title
    });
    newList.save()
        .then(listDoc => { res.send(listDoc); })
        .catch(e => res.send(e));
});

// Update List
app.patch('/lists/:listId', (req, res) => {
    List.findOneAndUpdate({ _id: req.params.listId }, {
        $set: req.body})
        .then(() => { res.sendStatus(200);})
        .catch(e => res.send(e));
});

// Delete List
app.delete('/lists/:listId', (req,res) => {
    const deleteTasks = (list) => {
        Task.deleteMany({ _listId: list._id })
        .then(() => list)
        .catch(e => res.send(e));
    };
    const list = List.findOneAndDelete({ _id: req.params.listId }) // or List.findByIdAndDelete(req.params.listId)
        .then(removedListDoc => deleteTasks(removedListDoc))
        .catch(e => res.send(e));
    res.send(list);
});

// Get all tasks in a specific list
app.get('/lists/:listId/tasks', (req,res) => {
    Task.find({ _listId: req.params.listId })
        .then(tasks => { res.send(tasks); })
        .catch(e => res.send(e));
});
// Get a specific task of a given list
app.get('/lists/:listId/tasks/:taskId', (req, res) => {
    Task.findOne({
        _id: req.params.taskId,
        _listId: req.params.listId
        })
        .then(resultTask => { res.send(resultTask); })
        .catch(e => res.send(e));
});

// Add new task in a specific list
app.post('/lists/:listId/tasks', (req,res) => {
    let newTask = new Task({
        title: req.body.title,
        _listId: req.params.listId   
    });
    newTask.save()
    .then(newTaskDoc => { res.send(newTaskDoc); })
    .catch(e => res.send(e));
});

//Update task of a specific list
app.patch('/lists/:listId/tasks/:taskId', (req,res) => {
    Task.findOneAndUpdate({ 
        _id : req.params.taskId,
        _listId : req.params.listId
        }, { $set: req.body })
        .then(() => { res.send({message: 'Updated successfully'}); })
        .catch(e => res.send(e));
});

//Delete task of a specific list
app.delete('/lists/:listId/tasks/:taskId', (req,res) => {
    Task.findOneAndDelete({
        _id : req.params.taskId,
        _listId : req.params.listId
    })
    .then(deletedTask => { res.send(deletedTask); })
    .catch(e => res.send(e));
});


app.listen(PORT, () => {
    console.log(`Server is listening on  ${PORT}`);
});
