const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());



const verifyJWT = (req,res,next)=>{
  // console.log('auth',req.headers.authorization);
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access:no token'});
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({error:true,message:'unauthorized access:invalid token'});
    }
    console.log('decoded : ',decoded);
    req.decoded = decoded;
    // console.log('req.decoded: ',req.decoded);
    next();
  })
}



app.get('/',(req,res)=>{
    res.send('hello from news pro');
})




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xhpmdyt.mongodb.net/?retryWrites=true&w=majority`;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('newsPro').collection('users');
    const classesColloction = client.db('newsPro').collection('classes');



    const verifyAdmin = async(req,res,next) => {
      // console.log('verify admin');
      const email = req.decoded.data.email;
      const user = await userCollection.findOne({email:email});
      // console.log(user);
      if(user.type!=='admin')res.status(401).send({error:true,message:'Unauthorized access:not admin'})
      next();
      
    }


    app.post('/jwt',(req,res)=>{
        const user = req.body;
        // console.log(user);
        const token = jwt.sign({
            data: user
          }, process.env.JWT_SECRET, { expiresIn: '1h' });
        // console.log(token);
        res.send({token});
    })

    
    app.get('/users',verifyJWT,verifyAdmin,async(req,res)=>{
      // console.log('hello')
      const users = await userCollection.find().toArray();
      res.send(users);
    })


    app.post('/users', async (req, res) => {
        const user = req.body;
        // console.log(user);
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
  
        if (existingUser) {
          return res.send({ message: 'user already exists' })
        }
  
        const result = await userCollection.insertOne(user);
        res.send(result);
    });


    app.get('/users/:email',verifyJWT, async(req,res)=>{
      const email = req.params.email;
      const decodedEmail = req.decoded.data.email;
      // console.log('email: ',email);
      // console.log('dec email: ',decodedEmail);
      
      if(email!==decodedEmail){
        return res.status(401).send({error:true,message:'unauthorized access:emails do not match'});
      }
      const result = await userCollection.findOne({email:email})
      res.send(result);
    });


    app.put('/type',verifyJWT,verifyAdmin,async(req,res)=>{
      const { type, email } = req.body;
      
      const result = userCollection.findOneAndUpdate(
        { email: email },
        { $set: { type: type } },
        { upsert: true },
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update the document.' });
          }
        }
      )
      res.send(result);
    });


    app.get('/classes',verifyJWT,verifyAdmin,async(req,res)=>{
      const result = await classesColloction.find().toArray();
      res.send(result);
    })

    app.post('/classes',verifyJWT,async(req,res)=>{
      const _class = req.body;
      // console.log(_class);
      const result = classesColloction.insertOne(_class);
      res.send(result);
    });

    app.get('/classes/:id',verifyJWT,async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const result = await classesColloction.findOne({_id:new ObjectId(id)});
      // console.log('class',result);
      res.send(result);
    })

    app.put('/classes/:id/deny',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const { status, feedback } = req.body;

      const result = await classesColloction.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status:status, feedback:feedback } },
        { returnOriginal: false }
      );

      res.send(result);
    })

    app.put('/classes/:id/approve',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const { status } = req.body;

      const result = await classesColloction.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status } },
        { returnOriginal: false }
      );
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


// console.log(process.env.DB_USER)
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })


//   news-pro
// GxDOecW6Gbz8qYMm