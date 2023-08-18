const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mysql = require("mysql");
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { off } = require("process");
const { resolve } = require("path");
const { log } = require("console");
const port = 2000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniquePrefix + '-' + file.originalname;
        const fullPath = 'uploads/' + filename;
        cb(null, fullPath);
    }
});
const upload = multer({ storage: storage });

var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'chat_db'
});

conn.connect(function (err) {
    if (err) throw err;
    console.log('connect to database..');
});
var Users = `create table if not exists users(
    id int(10)auto_increment primary key,
    first_name varchar(20)not null,
    last_name varchar(20)not null,
    email_id varchar(30)not null unique,
    password varchar(10)not null,
    profile_photo varchar(255)default null
)`;
var conversationTable = `create table if not exists conversation(
    conversation_id int(10) auto_increment primary key,
    conversation_type int(5) not null,
    participant_id int(5),
    group_name varchar(30),
    last_message varchar(255),
    creater_id int(5),
    timestamp timestamp null
)`;
var participantTable = `create table if not exists participant(
    id int(5)auto_increment primary key,
    conversation_id int(5)not null,
    participant_id int(5)not null
)`;
var ConversationsTable = `create table if not exists conversations(
    conversation_id int(10)auto_increment primary key,
    sender_id int(10)not null,
    receiver_id int(10)not null
)`;
var MessagesTable = `create table if not exists messages(
    id int(10)auto_increment primary key,
    conversation_id int(10) not null,
    sender_id int(10) not null,
    receiver_id int(10) not null,
    message text not null,
    message_seen tinyint(1) default 0,
    timestamp timestamp default current_timestamp
)`;
var MessageTable = `create table if not exists message(
    id int(10)auto_increment primary key,
    conversation_id int(10) not null,
    participant_id int(10),
    message text not null,
    message_seen tinyint(1) default 0,
    timestamp timestamp default current_timestamp
)`;

conn.query(Users, (err, results) => {
    if (err) {
        console.log("error in table creating", err);
    } else {
        console.log("Users Table created successfully");
    }
});
conn.query(ConversationsTable, (err, results) => {
    if (err) {
        console.log("Error in conversations table creation:", err);
    } else {
        console.log("Conversations table created successfully");
    }
});
conn.query(MessagesTable, (err, results) => {
    if (err) {
        console.log("Error in messages table creation:", err);
    } else {
        console.log("Messages table created successfully");
    }
});
conn.query(MessageTable, (err, results) => {
    if (err) {
        console.log("Error in messages table creation:", err);
    } else {
        console.log("Message table created successfully");
    }
});
conn.query(conversationTable, (err, results) => {
    if (err) {
        console.log("Error in messages table creation:", err);
    } else {
        console.log("conversation table created successfully");
    }
});
conn.query(participantTable, (err, results) => {
    if (err) {
        console.log("Error in messages table creation:", err);
    } else {
        console.log("participant table created successfully");
    }
});

app.use('/', express.static('uploads'));

app.use(bodyParser.json());


app.get('/get_all_users', (req, res) => {
    const { page = 1, pageSize = 10, searchKey } = req.query;
    const offset = (page - 1) * pageSize;

    if (searchKey) {
        conn.query('select count(*) as total_count from users where first_name like ? or last_name like ? ', ['%' + searchKey + '%', '%' + searchKey + '%'], (err, results) => {
            if (err) {
                console.log("error in executing query:", err);
                return res.status(500).json({ error: "internal server error" });
            }

            const totalCount = results[0].total_count;
            const totalPages = Math.ceil(totalCount / pageSize);

            conn.query('select * from users where first_name like ? or last_name like ? limit ?,? ', ['%' + searchKey + '%', '%' + searchKey + '%', offset, pageSize], (err, results) => {
                if (err) {
                    console.log("error in executing query:", err);
                    return res.status(500).json({ error: "internal server error" });
                }
                return res.json({ status_code: 1, message: 'record fetch successfully', page, pageSize, totalPages, results });
            });

        })
    } else {
        conn.query('select count(*) as total_count from users', (err, countResults) => {
            if (err) {
                console.log("error in executing count query:", err);
                return res.status(500).json({ status_code: 0, error: "internal server error" });
            }

            const totalCount = countResults[0].total_count;
            const totalPages = Math.ceil(totalCount / pageSize);

            conn.query('select * from users limit ?, ?', [offset, pageSize], (err, results) => {
                if (err) {
                    console.log("error in executing query:", err);
                    return res.status(500).json({ status_code: 0, error: "internal server error" });
                }

                return res.json({ status_code: 1, message: 'record fetch successfully', page, pageSize, totalCount, totalPages, results });
            });
        });
    }

});

app.post('/get_user_By_Id', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ message: "Please enter user_id" });
    }

    conn.query('select * from users where id=?', [user_id], (err, result) => {
        if (err) {
            console.error('error in executing query:', err);
            return res.status(500).json({ status_code: 0, error: 'internal server error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.json({ status_code: 1, message: 'user fetched successfully', user: result[0] });
    });
})

// app.post('/', (req, res) => {
//     const { first_name, last_name, email_id, password } = req.body;
//     const user = { first_name, last_name, email_id, password };

//     conn.query('insert into users set ?', user, (err, results) => {
//         if (err) {
//             console.error('error in executing query:', err);
//             return res.status(500).json({ error: 'internal server error' });
//         }
//         res.json({ message: 'user created successfully', results });
//     });
// });

app.post('/login', (req, res) => {
    const { email_id, password } = req.body;
    if (!email_id)
        return res.status(400).json({ message: "Plaease enter email_id" });
    if (!password)
        return res.status(400).json({ message: "Plaease enter password" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_id)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    try {
        const user = 'select * from users where email_id=? and password=?';
        conn.query(user, [email_id, password], (err, results) => {
            if (err) {
                console.log('error in executing query', err);
                return res.status(500).json({ error: 'internal server error' });
            } else {
                if (results.length == 0) {
                    return res.status(401).json({ message: 'invalid credentials' });
                }
                return res.status(200).json({ status_code: 1, message: 'login successfull..', user: results[0] });
            }
        });
    } catch (err) {
        console.log("error in login", err);
        res.status(500).json({ status_code: 0, error: 'internal server error' });
    }
});


// app.post('/signin', (req, res) => {
//     const { first_name, last_name, email_id, password } = req.body;
//     const user = { first_name, last_name, email_id, password };
//     try {
//         const existingUser = 'select * from users where email_id = ?';

//         if (existingUser) {
//             return res.status(409).json({ message: 'user already exist' });
//         } else {
//             conn.query('insert into users set?', user, (err, results) => {
//                 if (err) {
//                     console.log('error in executing query', err);
//                     return res.status(500).json({ error: 'internal server error' });
//                 }
//                 res.json({ message: "Sign-in successfully", results });
//             })
//         }
//     } catch (err) {
//         console.log('error in signin', err);
//     }
// });
// app.post('/signup',upload.single('profilePhoto'), (req, res) => {
//     const { first_name, last_name, email_id, password } = req.body;

//     // if (!first_name || !last_name || !email_id || !password) {
//     //     return res.status(400).json({ error: "All fields are required" });
//     // }
//     if (!first_name)
//         return res.status(400).json({ error: "Plaease enter first_name" });
//     if (!last_name)
//         return res.status(400).json({ error: "Plaease enter last_name" });
//     if (!email_id)
//         return res.status(400).json({ error: "Plaease enter email_id" });
//     if (!password)
//         return res.status(400).json({ error: "Plaease enter password" });

//     // Regular expression for email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     // Check if the email is in a valid format
//     if (!emailRegex.test(email_id)) {
//         return res.status(400).json({ error: 'Invalid email format' });
//     }
//     const profilePhotoUrl = req.file ? '/path/to/upload/folder/' + req.file.filename : null;

//     const user = { first_name, last_name, email_id, password, profile_photo:profilePhotoUrl };

//     try {
//         const existingUser = 'SELECT * FROM users WHERE email_id = ?';

//         conn.query(existingUser, [email_id], (err, results) => {
//             if (err) {
//                 console.log('error in executing query', err);
//                 return res.status(500).json({ status_code: 0, error: 'internal server error' });
//             }
//             if (results.length > 0) {
//                 return res.status(409).json({ message: 'User already exists' });
//             } else {
//                 const insertRecord = 'INSERT INTO users SET ?';

//                 conn.query(insertRecord, user, (err, results) => {
//                     if (err) {
//                         console.log('error in executing query', err);
//                         return res.status(500).json({ status_code: 0, error: 'internal server error' });
//                     }
//                     const userData = {
//                         user_id: results.insertId,
//                         first_name,
//                         last_name,
//                         email_id,
//                         profile_photo:user.profile_photo,
//                     };

//                     res.status(200).json({
//                         status_code: 1,
//                         message: "Sign-in successfully",
//                         user: userData
//                     });
//                 });
//             }
//         });
//     } catch (err) {
//         console.log('error in signin', err);
//         res.status(500).json({ status_code: 0, error: 'internal server error' });
//     }
// });
app.post('/signup', upload.single('profile_photo'), (req, res) => {
    const { first_name, last_name, email_id, password } = req.body;

    if (!first_name || !last_name || !email_id || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Regular expression for email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Check if the email is in a valid format
    if (!emailRegex.test(email_id)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = { first_name, last_name, email_id, password };

    // Check if the uploaded profile photo exists
    let profile_photo = null;
    if (req.file) {
        profile_photo = req.file.filename;
    }

    const existingUser = 'select * from users where email_id = ?';

    conn.query(existingUser, [email_id], (err, results) => {
        if (err) {
            console.log('error in executing query', err);
            return res.status(500).json({ status_code: 0, error: 'internal server error' });
        }
        if (results.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        } else {
            const insertRecord = 'insert into users SET ?';

            conn.query(insertRecord, { ...user, profile_photo: profile_photo }, (err, results) => {
                if (err) {
                    console.log('error in executing query', err);
                    return res.status(500).json({ status_code: 0, error: 'internal server error' });
                }
                const userData = {
                    user_id: results.insertId,
                    first_name,
                    last_name,
                    email_id,
                    profile_photo
                };

                res.status(200).json({
                    status_code: 1,
                    message: "Sign-up successfully",
                    user: userData
                });
            });
        }
    });
});


app.delete('/deleteUser', (req, res) => {
    const userId = req.query.id;

    conn.query('delete from users where id=?', userId, (err, result) => {
        if (err) {
            console.error('error in executing query:', err);
            return res.status(500).json({ status_code: 0, error: 'internal server error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ status_code: 0, message: 'user not found' });
        }

        res.json({ status_code: 1, message: 'user deleted successfully' });
    });
});
// app.put('/updateUser',(req,res)=>{
//     const userId = req.query.id;

//     conn.query('update users set ? where id= ?',(err,results)=>{
//         if (err) {
//             console.error('error in executing query:', err);
//             return res.status(500).json({ status_code: 0, error: 'internal server error' });
//         }

//         if (results.affectedRows === 0) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         return res.status
//     })
// })
app.put('/updateUser', upload.single('profile_photo'), (req, res) => {
    const userId = req.query.id;
    const { first_name, last_name, email_id, password } = req.body;

    if (!first_name)
        return res.status(400).json({ error: "Please enter first_name" });
    if (!last_name)
        return res.status(400).json({ error: "Please enter last_name" });
    if (!email_id)
        return res.status(400).json({ error: "Please enter email_id" });
    if (!password)
        return res.status(400).json({ error: "Please enter password" });

    // Regular expression for email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Check if the email is in a valid format
    if (!emailRegex.test(email_id)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const updatedUser = { first_name, last_name, email_id, password };

    // Check if the uploaded profile photo exists
    let profile_photo = null;
    if (req.file) {
        profile_photo = req.file.filename;
        updatedUser.profile_photo = profile_photo; // Update the profile photo in the updatedUser object
    }

    conn.query('update users set ? WHERE id = ?', [updatedUser, userId], (err, results) => {
        if (err) {
            console.error('error in executing query:', err);
            return res.status(500).json({ status_code: 0, message: 'Email already Exists' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        conn.query('select * from users where id=?', [userId], (err, results) => {
            if (err) {
                console.log('error in update data', err);
                return res.status(500).json({ status_code: 0, error: "Internal server error" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({ status_code: 1, message: 'User updated successfully', user: results[0] });
        });
    });
});
// app.put('/updateUser', (req, res) => {
//     const userId = req.query.id;
//     const { first_name, last_name, email_id, password } = req.body;

//     if (!first_name)
//         return res.status(400).json({ error: "Plaease enter first_name" });
//     if (!last_name)
//         return res.status(400).json({ error: "Plaease enter last_name" });
//     if (!email_id)
//         return res.status(400).json({ error: "Plaease enter email_id" });
//     if (!password)
//         return res.status(400).json({ error: "Plaease enter password" });

//     // Regular expression for email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     // Check if the email is in a valid format
//     if (!emailRegex.test(email_id)) {
//         return res.status(400).json({ error: 'Invalid email format' });
//     }
//     const updateduser = { first_name, last_name, email_id, password };

//     conn.query('update users set ? WHERE id = ?', [updateduser, userId], (err, results) => {
//         if (err) {
//             console.error('error in executing query:', err);
//             return res.status(500).json({ status_code: 0, message: 'Email already Exists' });
//         }

//         if (results.affectedRows === 0) {
//             return res.status(404).json({ error: 'User not found' });
//         }
//         conn.query('select * from users where id=?', [userId], (err, results) => {
//             if (err) {
//                 console.log('error in uodate data', err);
//                 return res.status(500).json({ status_code: 0, error: "internal server error" });
//             }
//             if (results.affectedRows === 0) {
//                 return res.status(404).json({ error: "User not found" });
//             }
//             res.json({ status_code: 1, message: 'user updated successfully', user: results[0] });

//         });
//     });
// });

// app.post("/createConversation", (req, res) => {
//     const { user1_id, user2_id } = req.body;

//     if (!user1_id)
//         return res.status(400).json({ error: "Plaease enter user1_id" });
//     if (!user2_id)
//         return res.status(400).json({ error: "Plaease enter user2_id" });

//     try {

//         const sql = "select id from users where id in(?,?)";
//         conn.query(sql, [user1_id, user2_id], (err, results) => {
//             if (err) {
//                 console.error('Error executing query:', err);
//                 return res.status(500).json({ status_code: 0, message: 'Internal server error' });
//             }

//             if (results.length !== 2) {
//                 return res.status(404).json({ message: "Any one user_id is missing:" });
//             }

//             const ExistingRecord = "select user1_id,user2_id from conversations where user1_id=? and user2_id=?";
//             conn.query(ExistingRecord, [user1_id, user2_id], (err, results) => {
//                 if (err) {
//                     console.log("error in executing query:", err);
//                     return res.status(500).json({ status_code: 0, error: 'intenal server error:' });
//                 } else {
//                     return res.status(409).json({ message: 'Conversation already exists:' });
//                 }
//             })

//             const insertQuery = "insert into conversations  (user1_id,user2_id) values(?,?)";
//             conn.query(insertQuery, [user1_id, user2_id], (err, results) => {
//                 if (err) {
//                     console.log('error in executing query:', err);
//                     return res.status(500).json({ status_code: 0, message: 'intenal server error:' });
//                 }

//                 const conversationId = results.insertId;
//                 return res.status(200).json({ status_code: 1, message: 'record inserted successfully:', conversationId });
//             })
//         })
//     } catch (error) {
//         console.log('error in executing query:', err);
//         res.status(500).json({ status_code: 0, message: 'internal server error' });
//     }
// });


app.post("/createConversation", async (req, res) => {
    const { sender_id, receiver_id } = req.body;

    if (!sender_id)
        return res.status(400).json({ error: "Please enter sender_id" });
    if (!receiver_id)
        return res.status(400).json({ error: "Please enter receiver_id" });

    try {
        const selectSql = "SELECT id FROM users WHERE id IN (?, ?)";
        const selectResults = await new Promise((resolve, reject) => {
            conn.query(selectSql, [sender_id, receiver_id], (err, userresults) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(userresults);
                }
            });
        });

        if (selectResults.length !== 2) {
            return res.status(404).json({ message: "Any one user_id is missing:" });
        }

        const existingRecordQuery = `SELECT c1.conversation_id,
                                            u2.first_name as first_name,
                                            u2.last_name as last_name,
                                            u2.email_id as email_id
                                            FROM conversations c1
                                            join users u2 on (c1.sender_id and c1.receiver_id=u2.id) or (c1.receiver_id and c1.sender_id=u2.id)
                                            WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)`;

        const existingResults = await new Promise((resolve, reject) => {
            conn.query(existingRecordQuery, [sender_id, receiver_id, receiver_id, sender_id], (err, eResults) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(eResults);
                }
            });
        });

        if (existingResults.length > 0) {
            const existingConversation = existingResults[0];
            return res.status(200).json({ status_code: 0, message: 'Conversation already exists', user: existingConversation });
        }

        const insertQuery = "INSERT INTO conversations (sender_id, receiver_id) VALUES (?, ?)";
        const insertResults = await new Promise((resolve, reject) => {
            conn.query(insertQuery, [sender_id, receiver_id], (err, iResults) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(iResults);
                }
            });
        });

        const conversationId = insertResults.insertId;

        // Fetch receiver data from the users table
        const receiverQuery = "SELECT id as user_id,first_name,last_name,email_id FROM users WHERE id=?";
        const receiverData = await new Promise((resolve, reject) => {
            conn.query(receiverQuery, [receiver_id], (err, receiverResults) => {
                if (err) {
                    console.error('Error executing query:', err);
                    reject(err);
                } else {
                    resolve(receiverResults[0]);
                }
            });
        });


        // Return the response with receiver data
        return res.status(200).json({ status_code: 1, message: 'Record inserted successfully', conversation_id: conversationId, user: receiverData });
    } catch (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ status_code: 0, message: 'Internal server error' });
    }
});


// app.post('/get_conversations', (req, res) => {
//     const { user_id } = req.body;

//     if (!user_id) {
//         return res.status(400).json({ message: 'Please Enter user_id' });
//     }

//     try {
//         const sql = `select c1.conversation_id,
//                         c1.sender_id,
//                         u1.first_name as sender_firstname,
//                         u1.last_name as sender_lastname,
//                         u1.email_id as sender_email,
//                         c1.receiver_id,
//                         u2.first_name as receiver_firstname,
//                         u2.last_name as receiver_lastname,
//                         u2.email_id as receiver_email
//                     from conversations c1
//                     join users u1 on c1.sender_id = u1.id
//                     join users u2 on c1.receiver_id = u2.id
//                     where c1.sender_id = ? or c1.receiver_id = ?`;
//         //join users u2 on c1.receiver_id = u2.id
//         //or c1.receiver_id = ?
//         conn.query(sql, [user_id, user_id], (err, results) => {
//             if (err) {
//                 console.log("Error in executing query:", err);
//                 return res.status(500).json({ status_code: 0, message: "Internal server error:" });
//             }
//             if (!results.length > 0) {
//                 return res.status(409).json({ message: "Data not found:", conversations: results });
//             }

//             const conversations = results.map((row) => {
//                 return {
//                     conversation_id: row.conversation_id,
//                     sender: {
//                         sender_id: row.sender_id,
//                         first_name: row.sender_firstname,
//                         last_name: row.sender_lastname,
//                         email: row.sender_email,
//                     },
//                     receiver: {
//                         receiver_id: row.receiver_id,
//                         first_name: row.receiver_firstname,
//                         last_name: row.receiver_lastname,
//                         email: row.receiver_email,
//                     },
//                 };
//             });

//             return res.status(200).json({ status_code: 1, message: "Data fetched successfully", conversations });
//         });
//     } catch (error) {
//         console.log("Error in executing query:", error);
//         return res.status(500).json({ status_code: 0, message: 'Internal server error' });
//     }
// });

// app.post('/get_conversations', (req, res) => {
//     const { user_id } = req.body;

//     if (!user_id) {
//         return res.status(400).json({ message: 'Please Enter user_id' });
//     }

//     try {
//         const sql = `SELECT c1.conversation_id,
//                             CASE
//                                 WHEN c1.sender_id = ? THEN c1.receiver_id
//                                 ELSE c1.sender_id
//                             END AS receiver_id,
//                             u2.first_name AS receiver_firstname,
//                             u2.last_name AS receiver_lastname,
//                             u2.email_id AS receiver_email
//                     FROM conversations c1
//                     JOIN users u2 ON (c1.sender_id = ? AND c1.receiver_id = u2.id) OR
//                                     (c1.receiver_id = ? AND c1.sender_id = u2.id)
//                     WHERE c1.sender_id = ? OR c1.receiver_id = ?`;

//         conn.query(sql, [user_id, user_id, user_id, user_id, user_id], (err, results) => {
//             if (err) {
//                 console.log("Error in executing query:", err);
//                 return res.status(500).json({ status_code: 0, message: "Internal server error:" });
//             }
//             if (!results.length > 0) {
//                 return res.status(409).json({ message: "Data not found:", conversations: results });
//             }

//             const conversations = results.map((row) => {
//                 return {
//                     conversation_id: row.conversation_id,
//                     user: {
//                         user_id: row.receiver_id,
//                         first_name: row.receiver_firstname,
//                         last_name: row.receiver_lastname,
//                         email: row.receiver_email,
//                     },
//                 };
//             });

//             return res.status(200).json({ status_code: 1, message: "Data fetched successfully", conversations });
//         });
//     } catch (error) {
//         console.log("Error in executing query:", error);
//         return res.status(500).json({ status_code: 0, message: 'Internal server error' });
//     }
// });
// app.post('/get_conversations', async (req, res) => {
//     try {
//         const { user_id } = req.body;

//         if (!user_id) {
//             return res.status(400).json({ message: 'Please Enter user_id' });
//         }

//         const sql = `SELECT ...`; // Your SQL query here

//         conn.query(sql, [user_id, user_id, user_id, user_id, user_id], async (err, results) => {
//             if (err) {
//                 console.log("Error in executing query:", err);
//                 return res.status(500).json({ status_code: 0, message: "Internal server error:" });
//             }

//             if (results.length === 0) {
//                 return res.status(404).json({ message: "No conversations found" });
//             }

//             const conversationsWithLastMessage = [];

//             for (const row of results) {
//                 // ... (construct conversation object)

//                 try {
//                     const lastMessageQuery = "select ..."; // Your last message query here

//                     const [messageResults] = await conn.query(lastMessageQuery, [row.conversation_id]);
//                     const lastMessage = messageResults[0];

//                     conversation.lastMessage = lastMessage || { message: "No message found", timestamp: null };
//                     conversationsWithLastMessage.push(conversation);
//                 } catch (error) {
//                     console.log("Error in executing query:", error);
//                 }
//             }

//             return res.status(200).json({ status_code: 1, message: "Data fetched successfully", conversations: conversationsWithLastMessage });
//         });
//     } catch (error) {
//         console.log("Error in executing query:", error);
//         return res.status(500).json({ status_code: 0, message: 'Internal server error' });
//     }
// });

app.post('/get_conversations', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'Please Enter user_id' });
    }

    try {
        const sql = `SELECT c1.conversation_id,
                   CASE
                       WHEN c1.sender_id = ? THEN c1.receiver_id
                       ELSE c1.sender_id
                   END AS receiver_id,
                   u2.first_name AS receiver_firstname,
                   u2.last_name AS receiver_lastname,
                   u2.email_id AS receiver_email,
                   u2.profile_photo AS receiver_profile_photo
            FROM conversations c1
            JOIN users u2 ON (c1.sender_id = ? AND c1.receiver_id = u2.id) OR (c1.receiver_id = ? AND c1.sender_id = u2.id)
            WHERE c1.sender_id = ? OR c1.receiver_id = ?
        `;


        conn.query(sql, [user_id, user_id, user_id, user_id, user_id], async (err, results) => {
            if (err) {
                console.log("Error in executing query:", err);
                return res.status(500).json({ status_code: 0, message: "Internal server error:" });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "No conversations found" });
            }

            const conversationsWithLastMessage = [];

            for (const row of results) {
                const conversation = {
                    conversation_id: row.conversation_id,
                    user: {
                        user_id: row.receiver_id,
                        first_name: row.receiver_firstname,
                        last_name: row.receiver_lastname,
                        email: row.receiver_email,
                        profile_photo: row.receiver_profile_photo,
                    },
                };
                try {
                    const lastMessageQuery = "select sender_id,receiver_id,message,timestamp from messages where conversation_id=? order by timestamp desc limit 1";
                    const lastMessage = await new Promise((resolve, reject) => {
                        conn.query(lastMessageQuery, [row.conversation_id], (err, messageResults) => {
                            if (err) {
                                console.log("Error in executing query:", err);
                                reject(err);
                            } else {
                                resolve(messageResults[0]);
                            }
                        });
                    });

                    conversation.lastMessage = lastMessage //|| { message: "No message found", timestamp: null };
                    conversationsWithLastMessage.push(conversation);
                } catch (error) {
                    console.log("Error in executing query:", error);
                }
            }

            return res.status(200).json({ status_code: 1, message: "Data fetched successfully", conversations: conversationsWithLastMessage });
        });
    } catch (error) {
        console.log("Error in executing query:", error);
        return res.status(500).json({ status_code: 0, message: 'Internal server error' });
    }
});
app.post('/getConversations', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'Please provide user_id' });
    }

    const sql = `
        SELECT DISTINCT
            c.conversation_id,
            c.conversation_type,
            IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) AS receiver_id,
            u.first_name AS receiver_firstname,
            u.last_name AS receiver_lastname,
            u.email_id AS receiver_email,
            c.last_message AS last_message,
            c.timestamp AS conversation_timestamp
        FROM
            conversation c
            JOIN participant c1 ON c.conversation_id = c1.conversation_id
            JOIN participant c2 ON c.conversation_id = c2.conversation_id AND c1.participant_id <> c2.participant_id
            JOIN users u ON IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) = u.id
        WHERE
            c1.participant_id = ? OR c2.participant_id = ?
    `;

    conn.query(sql, [user_id, user_id, user_id, user_id], (err, results) => {
        if (err) {
            console.log('Error in executing query:', err);
            return res.status(500).json({ status_code: 0, message: 'Internal server error' });
        }

        const conversationsWithLastMessage = results.map((row) => {
            const conversation = {
                conversation_id: row.conversation_id,
                conversation_type: row.conversation_type,
                user: {
                    user_id: row.receiver_id,
                    first_name: row.receiver_firstname,
                    last_name: row.receiver_lastname,
                    email: row.receiver_email,
                },
            };

            if (row.last_message) {
                conversation.lastMessage = {
                    message: row.last_message,
                    timestamp: row.conversation_timestamp || null,
                };
            }

            return conversation;
        });

        return res.status(200).json({ status_code: 1, message: "Conversation fetched successfully", conversations: conversationsWithLastMessage });
    });
});



// app.delete('/deleteConversation', (req, res) => {
//     const { conversation_id } = req.body;

//     if (!conversation_id || !Array.isArray(conversation_id) || conversation_id.length === 0) {
//         return res.status(400).json({ message: "Please provide an array of conversation_id" });
//     }
//     conversation_id.forEach((conversation_id) => {
//         conn.query("delete from messages where conversation_id=?", [conversation_id], (err, messageresults) => {
//             if (err) {
//                 console.log("Error in executing query:", err);
//                 return res.status(500).json({ status_code: 0, message: "Internal server error" });
//             }


//             const deleted = [];
//             conn.query("delete from conversations where conversation_id=?", [conversation_id], (err, conversationResults) => {
//                 if (err) {
//                     console.log("Error in executing query:", err);
//                     return res.status(500).json({ status_code: 0, message: 'Internal server error' });
//                 }
//                 if (conversationResults.affectedRows === 0) {
//                     deleted.push(conversation_id);
//                     //return res.status(404).json({message:"This conversation_id was alredy deleted"});
//                 }

//                 if (deleted.length > 0) {
//                     return res.status(404).json({ message: "This conversation_id was alredy deleted" });
//                 } else {
//                     return res.status(200).json({ status_code: 1, message: "Conversations deleted successfully" });
//                 }
//             });
//         });
//     });
// });
app.delete('/deleteConversation', (req, res) => {
    const { conversation_id } = req.body;

    if (!conversation_id || !Array.isArray(conversation_id) || conversation_id.length === 0) {
        return res.status(400).json({ message: "Please provide an array of conversation_id" });
    }

    const deleted = [];

    const deleteConversation = (conversation_id) => {
        if (conversation_id.length === 0) {
            if (deleted.length > 0) {
                return res.status(404).json({ message: "This conversation_id were already deleted" });
            } else {
                return res.status(200).json({ status_code: 1, message: "Conversations deleted successfully" });
            }
        }

        const currentConversationId = conversation_id.pop();

        conn.query("delete from messages where conversation_id=?", [currentConversationId], (err, messageresults) => {
            if (err) {
                console.log("Error in executing messages deletion query:", err);
                return res.status(500).json({ status_code: 0, message: "Internal server error" });
            }

            conn.query("delete from conversations where conversation_id=?", [currentConversationId], (err, conversationResults) => {
                if (err) {
                    console.log("Error in executing conversations deletion query:", err);
                    return res.status(500).json({ status_code: 0, message: 'Internal server error' });
                }

                if (conversationResults.affectedRows === 0) {
                    deleted.push(currentConversationId);
                }

                deleteConversation(conversation_id);
            });
        });
    };

    deleteConversation(conversation_id.slice());
});
app.delete('/deleteConversations', (req, res) => {
    const { conversation_id } = req.body;

    if (!conversation_id || !Array.isArray(conversation_id) || conversation_id.length === 0) {
        return res.status(400).json({ message: "Please provide an array of conversation_id" });
    }

    const deleted = [];

    const deleteConversation = (conversation_ids) => {
        if (conversation_ids.length === 0) {
            if (deleted.length > 0) {
                return res.status(404).json({ message: "These conversation_id were already deleted", deleted });
            } else {
                return res.status(200).json({ status_code: 1, message: "Conversations deleted successfully" });
            }
        }

        const currentConversationId = conversation_ids.pop();

        // Delete messages
        conn.query("delete from message where conversation_id=?", [currentConversationId], (err, messageResults) => {
            if (err) {
                console.log("Error in executing messages deletion query:", err);
                return res.status(500).json({ status_code: 0, message: "Internal server error" });
            }

            // Delete participants
            conn.query("delete from participant where conversation_id=?", [currentConversationId], (err, participantResults) => {
                if (err) {
                    console.log("Error in executing participants deletion query:", err);
                    return res.status(500).json({ status_code: 0, message: "Internal server error" });
                }

                // Delete conversation
                conn.query("delete from conversation where conversation_id=?", [currentConversationId], (err, conversationResults) => {
                    if (err) {
                        console.log("Error in executing conversations deletion query:", err);
                        return res.status(500).json({ status_code: 0, message: 'Internal server error' });
                    }

                    if (conversationResults.affectedRows === 0) {
                        deleted.push(currentConversationId);
                    }

                    deleteConversation(conversation_ids);
                });
            });
        });
    };

    deleteConversation([...conversation_id]);
});



// app.post("/get_last_message", (req, res) => {
//     const { sender_id, receiver_id } = req.body;

//     if (!sender_id) {
//         return res.status(400).json({ message: "Please Enter sender_id" });
//     }
//     if (!receiver_id) {
//         return res.status(400).json({ message: "Please Enter receiver_id" });
//     }

//     const getLastMessage = "select * from messages where (sender_id=? and receiver_id=?) or (receiver_id=? and sender_id=?) order by timestamp desc limit 1";
//     //const getLastMessage = "select * from messages where (sender_id=? and receiver_id=?) or (receiver_id=? and sender_id=?)";
//     conn.query(getLastMessage, [sender_id, receiver_id, sender_id, receiver_id], (err, results) => {
//         if (err) {
//             console.log("Error in executing query:", err);
//             return res.status(500).json({ status_code: 0, message: 'Internal server error:' });
//         }
//         return res.status(200).json({ status_code: 1, message: 'Last Message get successfully', lastMessage: results });
//     });
// });
app.delete('/deleteMessage', async (req, res) => {
    const { message_id } = req.body;

    if (!message_id || !Array.isArray(message_id) || message_id.length === 0) {
        return res.status(400).json({ message: "Please provide array of message_id" });
    }

    try {
        for (const id of message_id) {
            await new Promise((resolve, reject) => {
                conn.query("delete from messages where id=?", [id], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        res.status(200).json({ status_code: 1, message: "Messages deleted successfully" });
    } catch (err) {
        console.log("Error in executing query:", err);
        res.status(500).json({ status_code: 0, message: "Internal server error" });
    }
});

// app.delete('/deleteMessage', (req, res) => {
//     const { message_id } = req.body;

//     if (!message_id || !Array.isArray(message_id) || message_id.length === 0) {
//         return res.status(400).json({ message: "Please provide array of message_id" });
//     }
//     message_id.forEach((message_id) => {
//         conn.query("delete from messages where id=?", [message_id], (err, results) => {
//             if (err) {
//                 console.log("Error in executing query:", err);
//                 return res.status(500).json({ status_code: 0, message: "Internal server error" });
//             }
//             return res.status(200).json({ status_code: 1, message: "Messsge deleted successfully" });
//         })
//     })
// });


app.delete('/deleteAllMessages', (req, res) => {
    const { conversation_id } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ message: "Please enter conversation_id" });
    }

    const deleteAllMessages = "delete from message where conversation_id = ?";
    conn.query(deleteAllMessages, [conversation_id], (err, results) => {
        if (err) {
            console.log("Error in executing query:", err);
            return res.status(500).json({ status_code: 0, message: "Internal server error" });
        }

        // const conversationInfo = "select * from conversations where conversation_id = ?";
        // conn.query(conversationInfo, [conversation_id], (err, conversationResults) => {
        //     if (err) {
        //         console.log("Error in executing query:", err)
        //         return res.status(500).json({ status_code: 0, message: "Internal server error" });
        //     }
        //     if (conversationResults.length === 0) {
        //         return res.status(404).json({ message: "Conversation not found:" });
        //     }
        //     const conversationInfo = conversationResults[0];
        return res.status(200).json({ status_code: 1, message: "All Messages deleted successfully" });
        // })
    });
});

app.post('/get_all_messages_by_conversation_Id', (req, res) => {
    const { conversation_id } = req.body;

    if (!conversation_id) {
        return res.status(400).json({ message: "Please enter conversation_id" });
    }

    conn.query('select * from message where conversation_id=?', [conversation_id], (err, results) => {
        if (err) {
            console.log("Error in executing query:", err);
            return res.status(500).json({ status_code: 0, message: "Internal server error" });
        }
        return res.status(200).json({ status_code: 1, message: "Messages fetched successfully", messages: results });
    });
});
// app.post('/get_all_messages_by_conversation_Id', (req, res) => {
//     const { conversation_id } = req.body;
//     if (!conversation_id) {
//         return res.status(400).json({ message: "Please enter conversation_id" });
//     }

//     const sql = `select m1.*,u1.id as sender_id,
//                             u1.first_name as sender_firstname,  
//                             u1.last_name as sender_lastname,
//                             u1.email_id as sender_email,
//                             u2.id as receiver_id,
//                             u2.first_name as receiver_firstname,
//                             u2.last_name as receiver_lastname,
//                             u2.email_id as receiver_email
//                             from messages m1
//                             join users u1 on m1.sender_id=u1.id
//                             join users u2 on m1.receiver_id=u2.id
//                             where m1.conversation_id =? `;


//     conn.query(sql, [conversation_id], (err, results) => {
//         if (err) {
//             console.log("Error in executing query", err);
//             return res.status(500).json({ status_code: 0, message: "Internal server error" });
//         }
//         if (results.length === 0) {
//             return res.status(404).json({ message: "No messages found on this conversation_id" });
//         }

//         const messages = results.map((row) => {
//             return {
//                 id: row.id,
//                 conversation_id: row.conversation_id,
//                 sender: {
//                     sender_id: row.sender_id,
//                     sender_firstname: row.sender_firstname,
//                     sender_lastname: row.sender_lastname,
//                     sender_email: row.sender_email
//                 },
//                 receiver: {
//                     receiver_id: row.receiver_id,
//                     receiver_firstname: row.receiver_firstname,
//                     receiver_lastname: row.receiver_lastname,
//                     receiver_email: row.receiver_email
//                 }
//             };
//         });
//         return res.status(200).json({ status_code: 1, message: "Messages fetched successfully", messages: messages });
//     });
// });


//========================================================================================================================



const userSockets = {}; // Object to map user IDs to sockets

io.on("connection", (socket) => {
    console.log("A user connected!");
    // Listen for the user's ID
    // socket.on("setUserId", (userId) => {
    //     userSockets[userId] = socket; // Map the user ID to the socket
    // });

    socket.on("join-dailog", (data) => {
        const { participant_id } = data;
        socket.join(participant_id);
    });

    socket.on("createConversation", async (data) => {
        const { sender_id, receiver_id } = data;

        if (!sender_id) {
            socket.emit("createConversation", { message: "Please enter sender_id" });
            return;
        }
        if (!receiver_id) {
            socket.emit("createConversation", { message: "Please enter receiver_id" });
            return;
        }
        // if (!sender_id || !receiver_id) {
        //   socket.emit("createConversation", { error: "Missing sender_id or receiver_id" });
        //   return;
        // }

        try {
            // Check if both sender and receiver exist in users table
            const selectSql = "SELECT id FROM users WHERE id IN (?, ?)";
            const selectResults = await new Promise((resolve, reject) => {
                conn.query(selectSql, [sender_id, receiver_id], (err, userresults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(userresults);
                    }
                });
            });

            if (selectResults.length !== 2) {
                socket.emit("createConversation", { error: "Any one user_id is missing" });
                return;
            }

            // Fetch receiver data
            const receiverQuery = "SELECT id as user_id, first_name, last_name, email_id FROM users WHERE id=?";
            const receiverData = await new Promise((resolve, reject) => {
                conn.query(receiverQuery, [receiver_id], (err, receiverResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(receiverResults[0]);
                    }
                });
            });
            const senderQuery = "SELECT id as user_id, first_name, last_name, email_id FROM users WHERE id=?";
            const senderData = await new Promise((resolve, reject) => {
                conn.query(senderQuery, [sender_id], (err, senderResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(senderResults[0]);
                    }
                });
            });

            // Check if conversation already exists
            const existingRecordQuery = `SELECT c1.conversation_id,
                                                c1.receiver_id as user_id,
                                                u2.first_name as first_name,
                                                u2.last_name as last_name,
                                                u2.email_id as email_id
                                                FROM conversations c1
                                                join users u2 on (c1.sender_id and c1.receiver_id=u2.id) or (c1.receiver_id and c1.sender_id=u2.id)
                                                WHERE (c1.sender_id=? AND c1.receiver_id=?) OR (c1.sender_id=? AND c1.receiver_id=?)`;


            const existingResults = await new Promise((resolve, reject) => {
                conn.query(existingRecordQuery, [sender_id, receiver_id, receiver_id, sender_id], (err, eResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(eResults);
                    }
                });
            });

            if (existingResults.length > 0) {
                const existingConversation = existingResults[0];
                socket.emit("createConversation", { error: "Conversation already exists", conversation: existingConversation });
                //socket.emit("createConversation", { error: "Conversation already exists", conversation: existingConversation, user: receiverData, sender: senderData });
                return;
            }

            // Insert new conversation
            const insertQuery = "INSERT INTO conversations (sender_id, receiver_id) VALUES (?, ?)";
            const insertResults = await new Promise((resolve, reject) => {
                conn.query(insertQuery, [sender_id, receiver_id], (err, iResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(iResults);
                    }
                });
            });

            const conversationId = insertResults.insertId;

            // Emit success event to sender and receiver
            io.emit("createConversation", { conversation_id: conversationId, user: receiverData, sender: senderData });
            io.to(sender_id).emit("createConversation", { conversation_id: conversationId, user: receiverData, sender: senderData });
            io.to(receiver_id).emit("createConversation", { conversation_id: conversationId, sender: senderData, user: receiverData });
        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("createConversation", { error: "Internal server error" });
        }
    });
    socket.on("createConversations", async (data) => {
        const { sender_id, receiver_id, conversation_type } = data;

        if (!sender_id || !receiver_id || !conversation_type) {
            socket.emit("createConversations", { error: "Missing required data" });
            return;
        }

        try {
            // Check if both sender and receiver exist in users table
            const selectSql = "select id from users where id IN (?, ?)";
            const selectResults = await new Promise((resolve, reject) => {
                conn.query(selectSql, [sender_id, receiver_id], (err, userresults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(userresults);
                    }
                });
            });

            if (selectResults.length !== 2) {
                socket.emit("createConversations", { error: "Any one user_id is missing" });
                return;
            }

            // Check if conversation already exists with the same participants and conversation type
            const existingConversationQuery = `
                SELECT c.conversation_id,u1.id AS sender_id, u1.first_name AS sender_first_name, u1.last_name AS sender_last_name,
                       u2.id AS receiver_id,u2.first_name AS receiver_first_name, u2.last_name AS receiver_last_name
                FROM conversation c
                JOIN participant p1 ON c.conversation_id = p1.conversation_id AND p1.participant_id = ?
                JOIN participant p2 ON c.conversation_id = p2.conversation_id AND p2.participant_id = ?
                JOIN users u1 ON p1.participant_id = u1.id
                JOIN users u2 ON p2.participant_id = u2.id
                WHERE c.conversation_type = ?
            `;
            const existingConversationResults = await new Promise((resolve, reject) => {
                conn.query(existingConversationQuery, [sender_id, receiver_id, conversation_type], (err, existingResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(existingResults);
                    }
                });
            });

            if (existingConversationResults.length > 0) {
                const existingConversation = existingConversationResults[0];
                socket.emit("createConversations", {
                    error: "Conversation already exists",
                    conversation_id: existingConversation.conversation_id,
                    // sender: {
                    //     id: existingConversation.sender_id,
                    //     first_name: existingConversation.sender_first_name,
                    //     last_name: existingConversation.sender_last_name,
                    // },
                    receiver: {
                        id: existingConversation.receiver_id,
                        first_name: existingConversation.receiver_first_name,
                        last_name: existingConversation.receiver_last_name,
                    },
                });
                return;
            }

            // Insert new conversation
            const insertConversationQuery = "insert into conversation (conversation_type) values (?)";
            const insertConversationResults = await new Promise((resolve, reject) => {
                conn.query(insertConversationQuery, [conversation_type], (err, iResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(iResults);
                    }
                });
            });

            const conversationId = insertConversationResults.insertId;

            // socket.join(conversationId);
            // console.log(conversationId);

            // Insert participants
            const insertParticipantsQuery = "insert into participant (conversation_id, participant_id) values (?, ?), (?, ?)";
            await new Promise((resolve, reject) => {
                conn.query(insertParticipantsQuery, [conversationId, sender_id, conversationId, receiver_id], (err) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Fetch receiver data
            const receiverQuery = "select id as user_id, first_name, last_name, email_id from users where id=?";
            const receiverData = await new Promise((resolve, reject) => {
                conn.query(receiverQuery, [receiver_id], (err, receiverResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(receiverResults[0]);
                    }
                });
            });
            const senderQuery = "select id as user_id, first_name, last_name, email_id from users where id=?";
            const senderData = await new Promise((resolve, reject) => {
                conn.query(senderQuery, [sender_id], (err, senderResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(senderResults[0]);
                    }
                });
            });

            // if (userSockets[sender_id]) {
            //     userSockets[sender_id].emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
            // }

            // if (userSockets[receiver_id]) {
            //     userSockets[receiver_id].emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
            // }
            // Emit success event to sender, receiver, and all clients
            //io.emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
            //io.to(conversationId).emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
            io.to(sender_id).emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
            io.to(receiver_id).emit("createConversations", { conversation_id: conversationId, sender: senderData, receiver: receiverData });
        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("createConversations", { error: "Internal server error" });
        }
    });


    socket.on("getConversations", async (data) => {
        const { user_id } = data;
        console.log(data);

        if (!user_id) {
            socket.emit("getConversations", { message: 'Please Enter user_id' });
            return;
        }

        try {
            const sql = `SELECT c1.conversation_id,
                       CASE
                           WHEN c1.sender_id = ? THEN c1.receiver_id
                           ELSE c1.sender_id
                       END AS receiver_id,
                       u2.first_name AS receiver_firstname,
                       u2.last_name AS receiver_lastname,
                       u2.email_id AS receiver_email
                FROM conversations c1
                JOIN users u2 ON (c1.sender_id = ? AND c1.receiver_id = u2.id) OR (c1.receiver_id = ? AND c1.sender_id = u2.id)
                WHERE c1.sender_id = ? OR c1.receiver_id = ?
            `;


            conn.query(sql, [user_id, user_id, user_id, user_id, user_id], async (err, results) => {
                if (err) {
                    console.log("Error in executing query:", err);
                    socket.emit("getConversations", { status_code: 0, message: "Internal server error:" });
                    return;
                }

                if (results.length === 0) {
                    socket.emit("getConversations", { message: "No conversations found" });;
                    return;
                }

                const conversationsWithLastMessage = [];

                for (const row of results) {
                    const conversation = {
                        conversation_id: row.conversation_id,
                        user: {
                            user_id: row.receiver_id,
                            first_name: row.receiver_firstname,
                            last_name: row.receiver_lastname,
                            email: row.receiver_email,
                        },
                    };
                    try {
                        const lastMessageQuery = "select sender_id,receiver_id,message,timestamp from messages where conversation_id=? order by timestamp desc limit 1";
                        const lastMessage = await new Promise((resolve, reject) => {
                            conn.query(lastMessageQuery, [row.conversation_id], (err, messageResults) => {
                                if (err) {
                                    console.log("Error in executing query:", err);
                                    reject(err);
                                } else {
                                    resolve(messageResults[0]);
                                }
                            });
                        });

                        conversation.lastMessage = lastMessage //|| { message: "No message found", timestamp: null };
                        conversationsWithLastMessage.push(conversation);
                    } catch (error) {
                        console.log("Error in executing query:", error);
                    }
                }

                io.emit("getConversations", { conversations: conversationsWithLastMessage });
                io.to(user_id).emit("getConversations", { conversations: conversationsWithLastMessage });
                console.log({ conversations: conversationsWithLastMessage });
                return;
            });
        } catch (error) {
            console.log("Error in executing query:", error);
            socket.emit("getConversations", { status_code: 0, message: 'Internal server error' });
            return;
        }
    });
    // socket.on("getConversation", async (data) => {
    //     const { conversation_id } = data;

    //     if (!conversation_id) {
    //         socket.emit("getConversation", { message: 'Please Enter conversation_id' });
    //         return;
    //     }

    //     try {
    //         const sql = `
    //             SELECT DISTINCT
    //                 c.conversation_id,
    //                 c.conversation_type,
    //                 IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) AS receiver_id,
    //                 u.first_name AS receiver_firstname,
    //                 u.last_name AS receiver_lastname,
    //                 u.email_id AS receiver_email,
    //                 m.message,
    //                 m.timestamp AS message_timestamp
    //             FROM
    //                 conversation c
    //                 JOIN participant c1 ON c.conversation_id = c1.conversation_id
    //                 JOIN participant c2 ON c.conversation_id = c2.conversation_id AND c1.participant_id <> c2.participant_id
    //                 JOIN users u ON IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) = u.id
    //                 LEFT JOIN (
    //                     SELECT
    //                         conversation_id,
    //                         MAX(timestamp) AS max_timestamp
    //                     FROM
    //                         message
    //                     GROUP BY
    //                         conversation_id
    //                 ) AS last_msg ON c.conversation_id = last_msg.conversation_id
    //                 LEFT JOIN message m ON last_msg.conversation_id = m.conversation_id AND last_msg.max_timestamp = m.timestamp
    //             WHERE
    //                 c1.participant_id = ? OR c2.participant_id = ?
    //         `;

    //         conn.query(sql, [conversation_id, conversation_id, conversation_id, conversation_id], (err, results) => {
    //             if (err) {
    //                 console.log("Error in executing query:", err);
    //                 socket.emit("getConversation", { status_code: 0, message: "Internal server error" });
    //                 return;
    //             }

    //             const conversationsWithLastMessage = results.map((row) => ({
    //                 conversation_id: row.conversation_id,
    //                 conversation_type: row.conversation_type,
    //                 user: {
    //                     user_id: row.receiver_id,
    //                     first_name: row.receiver_firstname,
    //                     last_name: row.receiver_lastname,
    //                     email: row.receiver_email,
    //                 },
    //                 lastMessage: {
    //                     message: row.message || "No message found",
    //                     timestamp: row.message_timestamp || null,
    //                 },
    //             }));

    //             io.emit("getConversation", { conversations: conversationsWithLastMessage });
    //             io.to(conversation_id).emit("getConversation", { conversations: conversationsWithLastMessage });
    //             console.log({ conversations: conversationsWithLastMessage });
    //         });
    //     } catch (error) {
    //         console.log("Error in executing query:", error);
    //         socket.emit("getConversation", { status_code: 0, message: 'Internal server error' });
    //     }
    // });
    socket.on("getConversationss", async (data) => {
        const { user_id } = data;

        if (!user_id) {
            socket.emit("getConversationss", { message: 'Please Enter user_id' });
            return;
        }

        try {
            const sql = `
                SELECT DISTINCT
                    c.conversation_id,
                    c.conversation_type,
                    IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) AS receiver_id,
                    u.first_name AS receiver_firstname,
                    u.last_name AS receiver_lastname,
                    u.email_id AS receiver_email,
                    c.last_message AS last_message,
                    c.timestamp AS conversation_timestamp
                FROM
                    conversation c
                    JOIN participant c1 ON c.conversation_id = c1.conversation_id
                    JOIN participant c2 ON c.conversation_id = c2.conversation_id AND c1.participant_id <> c2.participant_id
                    JOIN users u ON IF(c1.participant_id = ?, c2.participant_id, c1.participant_id) = u.id
                WHERE
                    c1.participant_id = ? OR c2.participant_id = ?
            `;

            conn.query(sql, [user_id, user_id, user_id, user_id], (err, results) => {
                if (err) {
                    console.log("Error in executing query:", err);
                    socket.emit("getConversationss", { status_code: 0, message: "Internal server error" });
                    return;
                }

                // const conversationsWithLastMessage = results.map((row) => ({
                //     conversation_id: row.conversation_id,
                //     conversation_type: row.conversation_type,
                //     user: {
                //         user_id: row.receiver_id,
                //         first_name: row.receiver_firstname,
                //         last_name: row.receiver_lastname,
                //         email: row.receiver_email,
                //     },

                //     lastMessage: {
                //         message: row.last_message || "No conversation message found",
                //         timestamp: row.conversation_timestamp || null,
                //     },
                // }));
                const conversationsWithLastMessage = results.map((row) => {
                    const conversation = {
                        conversation_id: row.conversation_id,
                        conversation_type: row.conversation_type,
                        user: {
                            user_id: row.receiver_id,
                            first_name: row.receiver_firstname,
                            last_name: row.receiver_lastname,
                            email: row.receiver_email,
                        },
                    };

                    if (row.last_message) {
                        conversation.lastMessage = {
                            message: row.last_message,
                            timestamp: row.conversation_timestamp || null,
                        };
                    }

                    return conversation;
                });

                // io.emit("getConversationss", { conversations: conversationsWithLastMessage });
                io.to(user_id).emit("getConversationss", { conversations: conversationsWithLastMessage });
                console.log({ conversations: conversationsWithLastMessage });
            });
        } catch (error) {
            console.log("Error in executing query:", error);
            socket.emit("getConversationss", { status_code: 0, message: 'Internal server error' });
        }
    });



    socket.on("join-chat", (data) => {
        const { conversation_id } = data;
        socket.join(conversation_id);
    });


    // socket.on("typing", (data) => {
    //     const { conversation_id, sender_id, isTyping } = data;
    //     io.to(conversation_id).emit("typing", { sender_id, isTyping });
    //     console.log(data);
    // });
    socket.on("typing", (data) => {
        const { conversation_id, participant_id, isTyping } = data;
        io.to(conversation_id).emit("typing", { participant_id, isTyping });
        console.log(data);
    });


    socket.on("send-message", (data) => {
        const { id, conversation_id, sender_id, receiver_id, message } = data;
        if (!conversation_id) {
            socket.emit("send-message", { message: 'Please Enter conversation_id' });
            return;
        }
        if (!sender_id) {
            socket.emit("send-message", { message: 'Please Enter sender_id' });
            return;
        }
        if (!receiver_id) {
            socket.emit("send-message", { message: 'Please Enter receiver_id' });
            return;
        }
        if (!message) {
            socket.emit("send-message", { message: 'Please Enter message' });
            return;
        }

        // Save the message to the messages table
        const insertQuery = "insert into messages (conversation_id, sender_id, receiver_id, message) values (?, ?, ?, ?)";
        conn.query(insertQuery, [conversation_id, sender_id, receiver_id, message], (err, results) => {
            if (err) {
                console.error("Error saving the message:", err);
            } else {
                // Emit the received message to the sender
                //io.to(conversation_id).emit("hi");
                const id = results.insertId;
                io.to(conversation_id).emit("send-message", {
                    id: id,
                    conversation_id: conversation_id,
                    sender_id: sender_id,
                    receiver_id: receiver_id,
                    message: message,
                });
                console.log(data);
            }
        });
    });
    // socket.on("send-messages", (data) => {
    //     const { id, conversation_id, participant_id, message } = data;
    //     if (!conversation_id) {
    //         socket.emit("send-messages", { message: 'Please Enter conversation_id' });
    //         return;
    //     }
    //     if (!participant_id) {
    //         socket.emit("send-messages", { message: 'Please Enter participant_id' });
    //         return;
    //     }
    //     if (!message) {
    //         socket.emit("send-messages", { message: 'Please Enter message' });
    //         return;
    //     }

    //     // Save the message to the messages table
    //     const insertQuery = "insert into message (conversation_id, participant_id, message) values (?, ?, ?)";
    //     conn.query(insertQuery, [conversation_id, participant_id, message], (err, results) => {
    //         if (err) {
    //             console.error("Error saving the message:", err);
    //         } else {
    //             const updateQuery = "update conversation set participant_id=?,last_message=?,timestamp=current_timestamp where conversation_id=?";
    //             conn.query(updateQuery, [participant_id, message, conversation_id], (err, updateResult) => {
    //                 if (err) {
    //                     console.log("Error in executing query:", err);
    //                 }
    //                 // Emit the received message to the sender
    //                 //io.to(conversation_id).emit("hi");
    //                 const id = results.insertId;
    //                 io.to(conversation_id).emit("send-messages", {
    //                     id: id,
    //                     conversation_id: conversation_id,
    //                     participant_id: participant_id,
    //                     message: message,
    //                 });
    //                 console.log(data);
    //             });
    //         }
    //     });
    // });
    socket.on("send-messagess", async (data) => {
        const { id, conversation_id, participant_id, receiver_id, message } = data;

        if (!conversation_id) {
            socket.emit("send-messagess", { message: 'Please Enter conversation_id' });
            return;
        }
        if (!participant_id) {
            socket.emit("send-messagess", { message: 'Please Enter participant_id' });
            return;
        }
        if (!receiver_id) {
            socket.emit("send-messagess", { message: 'Please Enter participanreceiver_idt_id' });
            return;
        }
        if (!message) {
            socket.emit("send-messagess", { message: 'Please Enter message' });
            return;
        }

        try {
            // Check if the participant is part of the specified conversation
            const checkParticipantQuery = "SELECT COUNT(*) AS participant_count FROM participant WHERE conversation_id = ? AND participant_id = ?";
            const participantCountResults = await new Promise((resolve, reject) => {
                conn.query(checkParticipantQuery, [conversation_id, participant_id], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (participantCountResults[0].participant_count === 0) {
                socket.emit("send-messages", { message: 'You are not a participant in this conversation' });
                return;
            }

            // Get participant data from the users table
            const getUserQuery = "select first_name, last_name, email_id from users where id=?";
            const userResults = await new Promise((resolve, reject) => {
                conn.query(getUserQuery, [participant_id], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
            if (userResults.length === 0) {
                socket.emit("send-messagess", { message: 'Participant not found' });
                return;
            }
            const user = userResults[0];
            // Get Receiver data from the users table
            const getreceiverQuery = "select first_name, last_name, email_id from users where id=?";
            const receiverResults = await new Promise((resolve, reject) => {
                conn.query(getUserQuery, [receiver_id], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
            if (userResults.length === 0) {
                socket.emit("send-messagess", { message: 'Participant not found' });
                return;
            }
            const receiver = receiverResults[0];

            // Save the message to the messages table
            const insertQuery = "INSERT INTO message (conversation_id, participant_id, message) VALUES (?, ?, ?)";
            const insertResults = await new Promise((resolve, reject) => {
                conn.query(insertQuery, [conversation_id, participant_id, message], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            const messageId = insertResults.insertId;

            // Update conversation with last message and timestamp
            const updateQuery = "UPDATE conversation SET participant_id = ?, last_message = ?, timestamp = current_timestamp WHERE conversation_id = ?";
            await new Promise((resolve, reject) => {
                conn.query(updateQuery, [participant_id, message, conversation_id], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Emit the received message to the conversation
            io.to(conversation_id).emit("send-messagess", {
                id: messageId,
                conversation_id: conversation_id,
                participant_id: participant_id,
                user: user,
                receiver: receiver,
                message: message,
            });

            console.log(data);
        } catch (err) {
            console.error("Error sending the message:", err);
            socket.emit("send-messagess", { message: 'Internal server error' });
        }
    });



    socket.on("message-seen", async (data) => {
        const { conversation_id, sender_id, message_id } = data;
        if (!conversation_id) {
            socket.emit("message-seen", { message: 'Please Enter conversation_id' });
            return;
        }
        if (!sender_id) {
            socket.emit("message-seen", { message: 'Please Enter participant_id' });
            return;
        }
        if (!message_id) {
            socket.emit("message-seen", { message: 'Please Enter message_id' });
            return;
        }

        // Update your database to mark the message as seen by the receiver
        const updateQuery = "update messages set message_seen = 1 where id = ?";
        conn.query(updateQuery, [message_id], (err, updateResult) => {
            if (err) {
                console.error("Error updating message status:", err);
            } else {
                console.log("Message marked as seen by receiver:", message_id);

                // Emit the "message-seen" event to the conversation room
                io.to(conversation_id).emit("message-seen", { sender_id, message_id });
                console.log(data);
            }
        });
    });
    socket.on("messages-seen", async (data) => {
        const { conversation_id, participant_id, message_id } = data;

        if (!conversation_id) {
            socket.emit("messages-seen", { message: 'Please Enter conversation_id' });
            return;
        }
        if (!participant_id) {
            socket.emit("messages-seen", { message: 'Please Enter participant_id' });
            return;
        }
        if (!message_id) {
            socket.emit("messages-seen", { message: 'Please Enter message_id' });
            return;
        }

        // Update your database to mark the message as seen by the receiver
        const updateQuery = "update message set message_seen = 1 where id = ? and participant_id = ?";
        conn.query(updateQuery, [message_id, participant_id], (err, updateResult) => {
            if (err) {
                console.error("Error updating message status:", err);
            } else {
                console.log("Message marked as seen by receiver:", message_id);

                // Emit the "message-seen" event to the conversation room
                io.to(conversation_id).emit("messages-seen", { participant_id, message_id });
                console.log(data);
            }
        });
    });


    socket.on("delete-message", (data) => {
        const { message_id, conversation_id } = data;

        // Ensure message_id is an array before using map function
        if (!Array.isArray(message_id)) {
            console.log("Invalid message_id data received.");
            return;
        }

        // Create placeholders for the message IDs in the SQL query
        const placeholders = message_id.map(() => '?').join(',');
        console.log(placeholders);

        const deleteQuery = `DELETE FROM messages WHERE id IN (${placeholders})`;
        conn.query(deleteQuery, message_id, (err, results) => {
            if (err) {
                console.log("Error in executing query", err);
            } else {
                const deletedMessageIds = message_id;

                // Confirm successful deletion and then emit the event for each deleted message
                deletedMessageIds.forEach((deletedMessageId) => {
                    io.to(conversation_id).emit("delete-message", { deletedMessageId });
                    console.log(`Deleted message ${deletedMessageId}`);
                });
            }
        });
    });
    socket.on("delete-messages", (data) => {
        const { message_id, conversation_id } = data;
        if (!Array.isArray(message_id)) {
            console.log("Invalid message_id data received.");
            return;
        }

        // Create placeholders for the message IDs in the SQL query
        const placeholders = message_id.map(() => '?').join(',');
        console.log(placeholders);

        const deleteQuery = `delete from message where id IN (${placeholders})`;
        conn.query(deleteQuery, message_id, (err, results) => {
            if (err) {
                console.log("Error in executing query", err);
            } else {
                const deletedMessageIds = message_id;

                // Confirm successful deletion and then emit the event for each deleted message
                deletedMessageIds.forEach((deletedMessageId) => {
                    io.emit("delete-messages", { deletedMessageId });
                    io.to(conversation_id).emit("delete-messages", { deletedMessageId });
                    console.log(`Deleted message ${deletedMessageId}`);
                });
            }
        });
    });
    socket.on("delete-messagess", (data) => {
        const { message_id, conversation_id, } = data;
        if (!Array.isArray(message_id)) {
            console.log("Invalid message_id data received.");
            return;
        }

        const placeholders = message_id.map(() => '?').join(',');

        // Create a subquery to get the new last message after deleting
        const subquery = `
            SELECT id, participant_id, message, timestamp
            FROM message
            WHERE conversation_id = ? AND id NOT IN (${placeholders})
            ORDER BY timestamp DESC
            LIMIT 1
        `;

        const deleteQuery = `DELETE FROM message WHERE id IN (${placeholders})`;

        conn.query(deleteQuery, message_id, (err, deleteResults) => {
            if (err) {
                console.log("Error in executing delete query:", err);
            } else {
                const deletedMessageIds = message_id;

                // Emit delete event for each deleted message
                deletedMessageIds.forEach((deletedMessageId) => {
                    io.emit("delete-messagess", { deletedMessageId });
                    io.to(conversation_id).emit("delete-messagess", { deletedMessageId });
                    console.log(`Deleted message ${deletedMessageId}`);
                });

                // Update conversation's last_message, last_message_timestamp, and last_message_participant
                conn.query(subquery, [conversation_id, ...message_id], (subqueryErr, subqueryResults) => {
                    if (subqueryErr) {
                        console.log("Error in subquery:", subqueryErr);
                    } else {
                        const newLastMessage = subqueryResults[0];

                        const updateLastMessageQuery = `
                            UPDATE conversation
                            SET last_message = ?, 
                                timestamp = ?,
                                participant_id = ?
                            WHERE conversation_id = ?
                        `;

                        if (newLastMessage) {
                            // Update with new last message information
                            conn.query(updateLastMessageQuery, [newLastMessage.message, newLastMessage.timestamp, newLastMessage.participant_id, conversation_id], (updateErr) => {
                                if (updateErr) {
                                    console.log("Error updating last message in conversation:", updateErr);
                                }
                            });
                        } else {
                            // No last message found, set null values
                            conn.query(updateLastMessageQuery, [null, null, null, conversation_id], (updateErr) => {
                                if (updateErr) {
                                    console.log("Error setting null values in conversation:", updateErr);
                                }
                            });
                        }
                    }
                });
            }
        });
    });

    /*=====================================================================================================================================*/

    // socket.on("createGroups", async (data) => {
    //     const { group_name, participants } = data;

    //     if (!group_name || !participants || participants.length < 2) {
    //         socket.emit("createGroup", { error: "Invalid group data" });
    //         return;
    //     }

    //     try {
    //         // Check if all participants exist in users table
    //         const participantIds = participants;
    //         const selectSql = "SELECT id FROM users WHERE id IN (?)";
    //         const selectResults = await new Promise((resolve, reject) => {
    //             conn.query(selectSql, [participantIds], (err, userResults) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(userResults);
    //                 }
    //             });
    //         });

    //         if (selectResults.length !== participants.length) {
    //             socket.emit("createGroup", { error: "Invalid participant(s)" });
    //             return;
    //         }

    //         // Insert new group conversation
    //         const insertConversationQuery = "INSERT INTO conversation (conversation_type,participant_name) VALUES (?,?)";
    //         const insertConversationResults = await new Promise((resolve, reject) => {
    //             conn.query(insertConversationQuery, [2, group_name], (err, iResults) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(iResults);
    //                 }
    //             });
    //         });

    //         const conversationId = insertConversationResults.insertId;

    //         // Insert participants into participant table
    //         const insertParticipantsQuery = "INSERT INTO participant (conversation_id, participant_id) VALUES (?, ?)";
    //         const insertParticipantPromises = participants.map(participantId => {
    //             return new Promise((resolve, reject) => {
    //                 conn.query(insertParticipantsQuery, [conversationId, participantId], (err) => {
    //                     if (err) {
    //                         console.error('Error executing query:', err);
    //                         reject(err);
    //                     } else {
    //                         resolve();
    //                     }
    //                 });
    //             });
    //         });

    //         await Promise.all(insertParticipantPromises);

    //         // Fetch participant data from users table
    //         const participantsQuery = `
    //         SELECT id AS participant_id, first_name, last_name, email_id
    //         FROM users
    //         WHERE id IN (?)
    //     `;
    //         const participantData = await new Promise((resolve, reject) => {
    //             conn.query(participantsQuery, [participantIds], (err, participantResults) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(participantResults);
    //                 }
    //             });
    //         });

    //         // Emit success event to participants with conversation details and participant information
    //         participants.forEach(participantId => {
    //             const participantInfo = participantData.find(p => p.participant_id === participantId);
    //             if (participantInfo) {
    //                 io.to(participantId).emit("createGroup", {
    //                     conversation_id: conversationId,
    //                     group_name,
    //                     participants: participantData
    //                 });
    //                 console.log("conversation_id :" + conversationId,
    //                     group_name,
    //                     "participants :" + participantData);
    //             }
    //         });

    //     } catch (err) {
    //         console.error('Error executing query:', err);
    //         socket.emit("createGroup", { error: "Internal server error" });
    //     }
    // });

    socket.on("createGroup", async (data) => {
        const { creater_id, group_name, participants } = data;

        if (!creater_id || !group_name || !participants || participants.length < 2) {
            socket.emit("createGroup", { error: "Invalid group data" });
            return;
        }

        try {
            // Check if all participants exist in users table
            const participantIds = participants;
            const selectSql = "select id from users where id IN (?)";
            const selectResults = await new Promise((resolve, reject) => {
                conn.query(selectSql, [participantIds], (err, userResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(userResults);
                    }
                });
            });

            if (selectResults.length !== participants.length) {
                socket.emit("createGroup", { error: "Invalid participant(s)" });
                return;
            }

            // Check if a group with the same participants and group name already exists
            const existingGroupQuery = `
                SELECT c.conversation_id
                FROM conversation c
                JOIN participant p ON c.conversation_id = p.conversation_id AND p.participant_id IN (?)
                WHERE c.conversation_type = 2 AND c.group_name = ?
            `;
            const existingGroupResults = await new Promise((resolve, reject) => {
                conn.query(existingGroupQuery, [participantIds, group_name], (err, existingResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(existingResults);
                    }
                });
            });

            if (existingGroupResults.length > 0) {
                socket.emit("createGroup", { error: "Group with the same participants and group name already exists" });
                return;
            }

            // Insert new group conversation
            const insertConversationQuery = "insert into conversation (conversation_type, group_name, creater_id) values(?, ?, ?)";
            const insertConversationResults = await new Promise((resolve, reject) => {
                conn.query(insertConversationQuery, [2, group_name, creater_id], (err, iResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(iResults);
                    }
                });
            });

            const conversationId = insertConversationResults.insertId;

            // Insert participants into participant table
            const insertParticipantsQuery = "insert into participant (conversation_id, participant_id) values (?, ?)";
            const insertParticipantPromises = participants.map(participantId => {
                return new Promise((resolve, reject) => {
                    conn.query(insertParticipantsQuery, [conversationId, participantId], (err) => {
                        if (err) {
                            console.error('Error executing query:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });

            await Promise.all(insertParticipantPromises);

            // Fetch participant data from users table
            const participantsQuery = "select id as participant_id,first_name,last_name,email_id from users where id In (?)";
            const participantData = await new Promise((resolve, reject) => {
                conn.query(participantsQuery, [participantIds], (err, participantResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(participantResults);
                    }
                });
            });

            // Emit success event to participants with conversation details and participant information
            participants.forEach(participantId => {
                const participantInfo = participantData.find(p => p.participant_id === participantId);
                if (participantInfo) {
                    io.to(participantId).emit("createGroup", {
                        conversation_id: conversationId,
                        group_name,
                        participants: participantData,
                        created_by: creater_id
                    });
                }
            });

        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("createGroup", { error: "Internal server error" });
        }
    });

    // socket.on("addParticipantsToGroup", async (data) => {
    //     const { conversation_id, participants } = data;

    //     if (!conversation_id || !participants || participants.length < 1) {
    //         socket.emit("addParticipantsToGroup", { error: "Invalid data" });
    //         return;
    //     }

    //     try {
    //         // Check if the conversation exists and is a group conversation
    //         const conversationQuery = "SELECT conversation_id FROM conversation WHERE conversation_id = ? AND conversation_type = 2";
    //         const conversationResults = await new Promise((resolve, reject) => {
    //             conn.query(conversationQuery, [conversation_id], (err, results) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(results);
    //                 }
    //             });
    //         });

    //         if (conversationResults.length === 0) {
    //             socket.emit("addParticipantsToGroup", { error: "Group conversation not found" });
    //             return;
    //         }

    //         // Check if new participants exist in users table
    //         const participantIds = participants;
    //         const selectSql = "SELECT id FROM users WHERE id IN (?)";
    //         const selectResults = await new Promise((resolve, reject) => {
    //             conn.query(selectSql, [participantIds], (err, userResults) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(userResults);
    //                 }
    //             });
    //         });

    //         if (selectResults.length !== participants.length) {
    //             socket.emit("addParticipantsToGroup", { error: "Invalid participant(s)" });
    //             return;
    //         }

    //         // Insert new participants into participant table
    //         const insertParticipantsQuery = "INSERT INTO participant (conversation_id, participant_id) VALUES (?, ?)";
    //         const insertParticipantPromises = participants.map(participantId => {
    //             return new Promise((resolve, reject) => {
    //                 conn.query(insertParticipantsQuery, [conversation_id, participantId], (err) => {
    //                     if (err) {
    //                         console.error('Error executing query:', err);
    //                         reject(err);
    //                     } else {
    //                         resolve();
    //                     }
    //                 });
    //             });
    //         });

    //         await Promise.all(insertParticipantPromises);

    //         // Fetch updated participant data from users table
    //         const updatedParticipantsQuery = "SELECT id AS participant_id, first_name, last_name, email_id FROM users WHERE id IN (?)";
    //         const updatedParticipantData = await new Promise((resolve, reject) => {
    //             conn.query(updatedParticipantsQuery, [participantIds], (err, updatedParticipantResults) => {
    //                 if (err) {
    //                     console.error('Error executing query:', err);
    //                     reject(err);
    //                 } else {
    //                     resolve(updatedParticipantResults);
    //                 }
    //             });
    //         });

    //         // Emit success event to participants with updated participant information
    //         participants.forEach(participantId => {
    //             const participantInfo = updatedParticipantData.find(p => p.participant_id === participantId);
    //             if (participantInfo) {
    //                 io.to(participantId).emit("addParticipantsToGroup", {
    //                     conversation_id,
    //                     addedParticipants: updatedParticipantData
    //                 });
    //             }
    //         });

    //     } catch (err) {
    //         console.error('Error executing query:', err);
    //         socket.emit("addParticipantsToGroup", { error: "Internal server error" });
    //     }
    // });
    socket.on("addParticipantsToGroup", async (data) => {
        const { conversation_id, participants } = data;

        if (!conversation_id || !participants || participants.length < 1) {
            socket.emit("addParticipantsToGroup", { error: "Invalid data" });
            return;
        }

        try {
            // Check if the conversation exists and is a group conversation
            const conversationQuery = "SELECT conversation_id FROM conversation WHERE conversation_id = ? AND conversation_type = 2";
            const conversationResults = await new Promise((resolve, reject) => {
                conn.query(conversationQuery, [conversation_id], (err, results) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (conversationResults.length === 0) {
                socket.emit("addParticipantsToGroup", { error: "Group conversation not found" });
                return;
            }

            // Check if new participants exist in users table
            const selectSql = "SELECT id FROM users WHERE id IN (?)";
            const selectResults = await new Promise((resolve, reject) => {
                conn.query(selectSql, [participants], (err, userResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(userResults);
                    }
                });
            });

            if (selectResults.length !== participants.length) {
                socket.emit("addParticipantsToGroup", { error: "Invalid participant(s)" });
                return;
            }

            // Get the existing participants in the conversation
            const existingParticipantsQuery = "SELECT participant_id FROM participant WHERE conversation_id = ?";
            const existingParticipantsResults = await new Promise((resolve, reject) => {
                conn.query(existingParticipantsQuery, [conversation_id], (err, existingResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(existingResults.map(row => row.participant_id));
                    }
                });
            });

            // Filter out participants who are already in the conversation
            const newParticipants = participants.filter(participantId => !existingParticipantsResults.includes(participantId));

            if (newParticipants.length === 0) {
                socket.emit("addParticipantsToGroup", { error: "Participants are already present in the conversation" });
                return;
            }
            // Insert new participants into participant table
            const insertParticipantsQuery = "INSERT INTO participant (conversation_id, participant_id) VALUES (?, ?)";
            const insertParticipantPromises = newParticipants.map(participantId => {
                return new Promise((resolve, reject) => {
                    conn.query(insertParticipantsQuery, [conversation_id, participantId], (err) => {
                        if (err) {
                            console.error('Error executing query:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });

            await Promise.all(insertParticipantPromises);

            // Fetch updated participant data from users table
            const updatedParticipantsQuery = "SELECT id AS participant_id, first_name, last_name, email_id FROM users WHERE id IN (?)";
            const updatedParticipantData = await new Promise((resolve, reject) => {
                conn.query(updatedParticipantsQuery, [newParticipants], (err, updatedParticipantResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(updatedParticipantResults);
                    }
                });
            });

            // Emit success event to participants with updated participant information
            newParticipants.forEach(participantId => {
                const participantInfo = updatedParticipantData.find(p => p.participant_id === participantId);
                if (participantInfo) {
                    io.to(participantId).emit("addParticipantsToGroup", {
                        conversation_id,
                        addedParticipants: updatedParticipantData
                    });
                }
            });

        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("addParticipantsToGroup", { error: "Internal server error" });
        }
    });

    socket.on("removeParticipantsFromGroup", async (data) => {
        const { conversation_id, participants } = data;

        if (!conversation_id || !participants || participants.length < 1) {
            socket.emit("removeParticipantsFromGroup", { error: "Invalid data" });
            return;
        }

        try {
            // Check if the conversation exists and is a group conversation
            const conversationQuery = "SELECT conversation_id FROM conversation WHERE conversation_id = ? AND conversation_type = 2";
            const conversationResults = await new Promise((resolve, reject) => {
                conn.query(conversationQuery, [conversation_id], (err, results) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (conversationResults.length === 0) {
                socket.emit("removeParticipantsFromGroup", { error: "Group conversation not found" });
                return;
            }

            // Get the existing participants in the conversation
            const existingParticipantsQuery = "SELECT participant_id FROM participant WHERE conversation_id = ?";
            const existingParticipantsResults = await new Promise((resolve, reject) => {
                conn.query(existingParticipantsQuery, [conversation_id], (err, existingResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(existingResults.map(row => row.participant_id));
                    }
                });
            });

            // Filter out participants who are not in the conversation
            const participantsToRemove = participants.filter(participantId => existingParticipantsResults.includes(participantId));

            if (participantsToRemove.length === 0) {
                socket.emit("removeParticipantsFromGroup", { error: "Participants are not present in the conversation" });
                return;
            }

            // Remove participants from participant table
            const removeParticipantsQuery = "DELETE FROM participant WHERE conversation_id = ? AND participant_id IN (?)";
            await new Promise((resolve, reject) => {
                conn.query(removeParticipantsQuery, [conversation_id, participantsToRemove], (err) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Emit success event to remaining participants with updated participant information
            const remainingParticipantsQuery = "SELECT id AS participant_id, first_name, last_name, email_id FROM users WHERE id IN (?)";
            const remainingParticipantData = await new Promise((resolve, reject) => {
                conn.query(remainingParticipantsQuery, [existingParticipantsResults.filter(id => !participantsToRemove.includes(id))], (err, remainingParticipantResults) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(remainingParticipantResults);
                    }
                });
            });

            existingParticipantsResults.forEach(participantId => {
                if (!participantsToRemove.includes(participantId)) {
                    const participantInfo = remainingParticipantData.find(p => p.participant_id === participantId);
                    if (participantInfo) {
                        io.to(participantId).emit("removeParticipantsFromGroup", {
                            conversation_id,
                            remainingParticipants: remainingParticipantData
                        });
                    }
                }
            });

        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("removeParticipantsFromGroup", { error: "Internal server error" });
        }
    });


    socket.on("sendMessage", async (data) => {
        const { conversation_id, sender_id, message } = data;

        if (!conversation_id || !sender_id || !message) {
            socket.emit("sendMessage", { error: "Invalid message data" });
            return;
        }

        try {
            const conversationQuery = "SELECT conversation_id FROM conversation WHERE conversation_id = ? AND conversation_type = 2";
            const conversationResults = await new Promise((resolve, reject) => {
                conn.query(conversationQuery, [conversation_id], (err, results) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (conversationResults.length === 0) {
                socket.emit("sendMessage", { error: "Group conversation not found" });
                return;
            }

            const insertMessageQuery = "INSERT INTO messages (conversation_id, sender_id, message) VALUES (?, ?, ?)";
            await new Promise((resolve, reject) => {
                conn.query(insertMessageQuery, [conversation_id, sender_id, message], (err) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            io.to(conversation_id).emit("sendMessage", {
                conversation_id,
                sender_id,
                message
            });

        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("sendMessage", { error: "Internal server error" });
        }
    });


    socket.on("deleteMessage", async (data) => {
        const { conversation_id, message_id } = data;

        if (!conversation_id || !message_id) {
            socket.emit("deleteMessage", { error: "Invalid data" });
            return;
        }

        try {
            const conversationQuery = "SELECT conversation_id FROM conversation WHERE conversation_id = ? AND conversation_type = 2";
            const conversationResults = await new Promise((resolve, reject) => {
                conn.query(conversationQuery, [conversation_id], (err, results) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (conversationResults.length === 0) {
                socket.emit("deleteMessage", { error: "Group conversation not found" });
                return;
            }

            const deleteMessageQuery = "DELETE FROM messages WHERE conversation_id = ? AND message_id = ?";
            await new Promise((resolve, reject) => {
                conn.query(deleteMessageQuery, [conversation_id, message_id], (err) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            io.to(conversation_id).emit("deleteMessage", {
                conversation_id,
                message_id
            });

        } catch (err) {
            console.error('Error executing query:', err);
            socket.emit("deleteMessage", { error: "Internal server error" });
        }
    });


    socket.on("disconnect", () => {
        console.log("A user disconnected!");
        // for (const userId in userSockets) {
        //     if (userSockets[userId] === socket) {
        //         delete userSockets[userId];
        //         console.log("A user disconnected:", userId);
        //         break;
        //     }
        // }
    });
});

io.listen(8000);

app.listen(port, () => {
    console.log(`server running on Port ${port}`);
})

