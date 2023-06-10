const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.ytnqryr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.Authorization;
console.log(authorization)

  if (!authorization) {
      return res.status(401).send({
          error: true,
          massage: "unauthorized access"
      })
  } else {
      const token = authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
          if (error) {
              return res.status(401).send({
                  error: true,
                  massage: "unauthorized access"
              })
          }
          req.decoded = decoded;
          next()
      })
  }

}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db('dancedb').collection('users')
    const classCollection = client.db('dancedb').collection('classes')




    app.post("/jwt", (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '1h'
      });
      res.send(token)

    })


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
          _id: new ObjectId(id)
      }
      const updatedDoc = {
          $set: {
              role: "admin"
          }
      }
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
  })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
          _id: new ObjectId(id)
      }
      const updatedDoc = {
          $set: {
              role: "instructor"
          }
      }
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
  })

    app.get('/allusers',async(req,res)=>{
      const result=await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/addClass', async(req,res)=>{
      const data=req.body;
      const result=await classCollection.insertOne(data);
      res.send(result);
      
    })
    app.put('/users', async (req, res) => {
      const user = req.body;
      const query = {
        email: user.email
      }
      const options = {
        upsert: true
      }
      const updateDoc = {
        $set: user

      };
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })
    app.get('/popularClass', async (req, res) => {
      const result = await classCollection.find().limit(6).sort({
        studentNumber: -1
      }).toArray()
      res.send(result)
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
  res.send('server is dancing')
})
app.listen(port, () => {
  console.log(`server is dancing on port ${port}`)
})