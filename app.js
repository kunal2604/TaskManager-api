const express = require('express');
const app = express();
const { mongoose } = require('./db/mongoose');

const PORT = process.env.PORT || 3000;
// Load mongoose models
const { List, Task, User } = require('./db/models'); //index.js is by default selected
const jwt = require('jsonwebtoken');

/* MIDDLEWARE */
// Load middleware
app.use(express.json());

// CORS Header Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Methods", "GET,POST,HEAD,OPTIONS,DELETE,PUT,PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");       
    
    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );

    next();
});

// check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');

    // verify the JWT
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if(err) {
            // there was an error
            // JWT is invalid; *DO NOT AUTHENTICATE*
            res.status(401).send(err);
        } else {
            // JWT is valid
            req.user_id = decoded._id;
            next();
        }
    });
}

// Verify Refresh Token Middleware (which will verify the session)
let verifySession = (req, res, next) => {
    // grab the refresh token from the request header
    let refreshToken = req.header('x-refresh-token');
    // grab the _id from the request header
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then(user => {
        if(!user) {
            // user couldn't be found
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct'
            });
        }
        // if the code reaches here, user was found; so session is valid
        // but we still have to check if the session expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;
        

        let isSessionValid = false;
        
        user.sessions.forEach(session => {
            if(session.token === refreshToken) {
                // check if the session has expired
                if(User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    // refresh token hasn't expired
                    isSessionValid = true;
                }
            }
        });

        if(isSessionValid) {
            // the session is VALID - call next() to continue with processing this web request
            next();
        } else {
            // the session is not valid
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            });
        }
    }).catch(e => {
        res.status(401).send(e);
    });
};

/* MIDDLEWARE ENDS*/

    // app.get('/', (req,res) => {
    //     res.send('Hello world!');
    // })
/**
 * GET /lists
 * Purpose: Get all lists
 */
app.get('/lists', authenticate, (req, res) => {
    // We want to return array of all the lists that belong to the authenticated user
    List.find({
        _userId: req.user_id
    }).then(lists => { res.send(lists); })
        .catch(e => { res.send(e); });
});

// Get Particular List
app.get('/lists/:listId', (req, res) => {
    List.find({_id: req.params.listId})
        .then(list => { res.send(list); })
        .catch(e => { res.send(e); });
});

// Add List
app.post('/lists', authenticate, (req, res) => {
    let title = req.body.title;
    let newList = new List({
        title,
        _userId: req.user_id
    });
    newList.save()
        .then(listDoc => { res.send(listDoc); })
        .catch(e => res.send(e));
});

// Update List
app.patch('/lists/:listId', authenticate, (req, res) => {
    List.findOneAndUpdate({ 
        _id: req.params.listId,
        _userId: req.user_id
    }, {
        $set: req.body})
        .then(() => { res.send({'message': 'List updated successfully'});})
        .catch(e => res.send(e));
});

// Delete List
app.delete('/lists/:listId', authenticate, (req,res) => {
    List.findOneAndRemove({ 
        _id: req.params.listId,
        _userId: req.user_id
    }) // or List.findByIdAndDelete(req.params.listId)
        .then(removedList => {
            res.send(removedList);

            // delete all tasks of that list
            deleteTasksFromList(removedList._id);
        })
});

// Get all tasks in a specific list
app.get('/lists/:listId/tasks', authenticate, (req,res) => {
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
app.post('/lists/:listId/tasks', authenticate, (req,res) => {
    
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then(list => {
        if(list) {
            // list object is valid 
            // currently authenticated user can create new tasks
            return true;
        }
        return false;
    }).then(canCreateTask => {
        if(canCreateTask) {
            // currently authenticated user can add a task
            let newTask = new Task({
                title: req.body.title,
                _listId: req.params.listId   
            });
            newTask.save()
            .then(newTaskDoc => { res.send(newTaskDoc); })
            .catch(e => res.send(e));
        } else {
            res.sendStatus(404);
        }
    });
});

//Update task of a specific list
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then(list => {
        if(list) {
            // list object is valid 
            // currently authenticated user can update a task
            return true;
        }
        return false;
    }).then(canUpdateTask => {
        if(canUpdateTask) {
            // currently authenticated user can update a task
            Task.findOneAndUpdate({ 
                _id : req.params.taskId,
                _listId : req.params.listId
            }, 
            { $set: req.body })
                .then(() => { res.send({message: 'Updated successfully'}); })
                .catch(e => res.send(e));
        } else {
            res.sendStatus(404);
        }
    });
});

//Delete task of a specific list
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
    
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then(list => {
        if(list) {
            // list object is valid 
            // currently authenticated user can delete a task
            return true;
        }
        return false;
    }).then(canDeleteTask => {
        if(canDeleteTask) {
            // currently authenticated user can update a task
            Task.findOneAndDelete({
                _id : req.params.taskId,
                _listId : req.params.listId
            })
            .then(deletedTask => { res.send(deletedTask); })
            .catch(e => res.send(e));
        } else {
            res.sendStatus(404);
        }
    });
});

/* USER ROUTES */
/** 
 * POST /users
 * Purpose: Sign up
*/
app.post('/users', (req,res) => {
    // User sign up
    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then(refreshToken => {
        // Session created successfully - refreshToken returned
        // now we generate an access auth token for the user
        return newUser.generateAccessAuthToken().then(accessToken => {
            return {accessToken, refreshToken}
        });
    }).then(authTokens => {
        // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);
    }).catch(e => {
        res.status(400).send(e);
    });
});

/**
 * POST /users/login
 * Purpose: Login
 */

app.post('/users/login', (req,res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then(user => {
        return user.createSession().then(refreshToken => {
            // Session created successfully - refreshToken returned
            // now we generate an access token for the user
            return user.generateAccessAuthToken().then(accessToken => {
                // access auth token generated successfully, now we return an object containing the auth tokens
                return { accessToken, refreshToken }
            }).then(authTokens => {
                res
                    .header('x-refresh-token', authTokens.refreshToken)
                    .header('x-access-token', authTokens.accessToken)
                    .send(user);

            });
        }).catch(e => {
            res.status(400).send(e);
        })
    });
});

/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, (req,res) => {
    // we know that the user/caller is authenticated and we have the user_id and user object available to us
    req.userObject.generateAccessAuthToken().then(accessToken => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch(e => {
        res.status(400).send(e);
    });
});


/* HELPER METHODS */
let deleteTasksFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log('All tasks of listId: ' + _listId + ' were deleted');
    })
}

app.listen(PORT, () => {
    console.log(`Server is listening on  ${PORT}`);
});