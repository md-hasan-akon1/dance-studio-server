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
    // await client.connect();
    const usersCollection = client.db('dancedb').collection('users')
    const classCollection = client.db('dancedb').collection('classes')
    const addCartCollection = client.db('dancedb').collection('addCarts')
    const paymentCollection = client.db('dancedb').collection('payments')

    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '24h'
      });
      res.send(token)

    })
    //verify admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {
        email: email
      }
      const user = await usersCollection.findOne(query);
      if (user ?.role !== 'admin') {
        return res.status(403).send({
          error: true,
          message: 'forbidden messagea'
        });
      }
      next();
    }
    //get all class for my class by instructor email
    app.get('/classes/instructor/:email',async(req,res)=>{
      const email=req.params.email;
      const query={email:email}
      const result=await classCollection.find(query).toArray();
      res.send(result)
    }) 
    //verify admin 
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {
        email: email
      }
      const user = await usersCollection.findOne(query);
      if (user ?.role !== 'instructor') {
        return res.status(403).send({
          error: true,
          message: 'forbidden messagei'
        });
      }
      next();
    }

    // check admin
    app.get('/users/role/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
      return  res.status(401).send({massage:'unauthorized'})
      }

      const query = {
        email: email
      }
      const user = await usersCollection.findOne(query);
      const result = {role:user.role }
      res.send(result);
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
    app.get('/allteacher',  async (req, res) => {
      const query = {
        role: 'instructor'
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })
    //save selected cart
    app.put('/carts',verifyJwt, async  (req, res) => {
      const body = req.body.data;
      const email = req.body.data.email;
      const id = req.body.data.id;
      const query = {
        $and: [{
          email: email
        }, {
          id: id
        }]
      }
      const cart = await addCartCollection.findOne({
        $and: [{
          email: email
        }, {
          id: id
        }]
      })
      if (cart) {
        return res.send('data already added')
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
    app.get('/enrolled/:email',verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const result = await paymentCollection.find(query).sort({date:-1}).toArray();
      res.send(result);
    })
    //delete selected class
    app.delete('/item/:id',verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: id
      }
      const result = await addCartCollection.deleteOne(query);
      res.send(result)
    })
    //get selected cart
    app.get('/add/cart/:email', verifyJwt, async (req, res) => {
      const query = {
        email: req.params.email
      }
      const result = await addCartCollection.find(query).toArray();
      res.send(result)
    })

    //set admin role
    app.patch('/users/admin/:id',verifyJwt,verifyAdmin, async (req, res) => {
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
    app.patch('/addclass/approve/:id',verifyJwt,verifyAdmin, async (req, res) => {
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
    app.patch('/addclass/deny/:id',verifyJwt,verifyAdmin, async (req, res) => {
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
    app.put('/addclass/feedback/:id',verifyJwt,verifyAdmin, async (req, res) => {
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
    app.get('/addedclass',verifyJwt,verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result)
    })


    //instructor role set
    app.patch('/users/instructor/:id', verifyJwt,verifyAdmin, async (req, res) => {
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
    app.get('/allusers',verifyJwt,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //inserted class by instructor
    app.post('/addClass',verifyJwt,verifyInstructor, async (req, res) => {
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
      const existingUser=await usersCollection.findOne(query)
      if(existingUser){
        return res.send({massage:'user existing'})
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
    app.post("/create-payment-intent",verifyJwt, async (req, res) => {

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
    app.patch('/payment/:id',verifyJwt, async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const options = {
        upsert: true
      }
      const query = {
        _id: id
      }
      const updatedDoc = {
        $set: body
      }
      const result = await paymentCollection.updateOne(query, updatedDoc, options)
      const filter = {
        _id: new ObjectId(body.id)
      }
      const upOptions = {
        upsert: true
      }
      const updatedDoc2 = {
        $set: {
          availableSeats: body.availableSeats - 1,
          studentNumber: body.studentNumber + 1
        }
      }

      const upResult = await classCollection.updateOne(filter, updatedDoc2, upOptions)


      const deleteQuery = {
        id: body.id
      }
      const deleteResult = await addCartCollection.deleteOne(deleteQuery)
      //   res.send(result)
      res.send({
        result,
        upResult,
        deleteResult
      })


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