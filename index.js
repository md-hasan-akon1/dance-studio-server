const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_sk)
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
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      error: true,
      massage: "unauthorized access1"
    })
  } else {
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
      if (error) {
        return res.status(401).send({
          error: true,
          massage: "unauthorized access2"
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
    const addCartCollection = client.db('dancedb').collection('addCarts')
    const paymentCollection = client.db('dancedb').collection('payments')



    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '1h'
      });
      res.send(token)

    })

    //get popular instructor
    app.get('/popularteacher', async (req, res) => {
      const query = {
        role: 'instructor'
      }
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result)
    })
    //get all teacher
    app.get('/allteacher', verifyJwt, async (req, res) => {
      const query = {
        role: 'instructor'
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })
    //save selected cart
    app.put('/carts', async (req, res) => {
      const body = req.body;
      const query = {
        email: req.query.email,
        _id: req.query.id
      }
      const options = {
        upsert: true
      }
      const updatedDoc = {
        $set: body

      }
      const result = await addCartCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    })
    //delete selected class
    app.delete('/item/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: id
      }
      const result = await addCartCollection.deleteOne(query);
      res.send(result)
    })
    //get selected cart
    app.get('/add/cart', verifyJwt, async (req, res) => {
      const result = await addCartCollection.find().toArray();
      res.send(result)
    })

    //set admin role
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
    //set approve status
    app.patch('/addclass/approve/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const updatedDoc = {
        $set: {
          status: "approved"
        }
      }
      const result = await classCollection.updateOne(query, updatedDoc);
      res.send(result);
    })
    //set deny status
    app.patch('/addclass/deny/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const updatedDoc = {
        $set: {
          status: "deny"
        }
      }
      const result = await classCollection.updateOne(query, updatedDoc);
      res.send(result);
    })
    //show approved class on the classes page
    app.get('/classes', async (req, res) => {
      const query = {
        status: 'approved'
      }

      const result = await classCollection.find(query).toArray()
      res.send(result)


    })
    //send feedback
    app.put('/addclass/feedback/:id', async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const options = {
        upsert: true
      }
      const updatedDoc = {
        $set: {
          feedback: data
        }
      }
      const result = await classCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    })
    //get all classes showing for admin posted by instructor 
    app.get('/addedclass', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result)
    })


    //instructor role set
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
    //get all users for showing admin
    app.get('/allusers', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //inserted class by instructor
    app.post('/addClass', async (req, res) => {
      const data = req.body;
      const result = await classCollection.insertOne(data);
      res.send(result);

    })
    //cheack user and set database
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
    //get all popular class base on student
    app.get('/popularClass', async (req, res) => {
      const query = {
        status: 'approved'
      }
      const result = await classCollection.find(query).limit(6).sort({
        studentNumber: -1
      }).toArray()
      res.send(result)
    })
    //create payment intent
    app.post("/create-payment-intent", async (req, res) => {

      const {
        price
      } = req.body;
      if (!price) {
        return
      }

      const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [
          "card"
        ],

      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    })

    //payment history
    app.post('/payment', (req, res) => {
const body=req.body;


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