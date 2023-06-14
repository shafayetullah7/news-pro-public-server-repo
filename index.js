const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
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
     client.connect();

    const userCollection = client.db('newsPro').collection('users');
    const classesCollection = client.db('newsPro').collection('classes');
    const enrollmentsCollection = client.db('newsPro').collection('enrollments');
    const testimonialCollection = client.db('newsPro').collection('testimonials');



    const verifyAdmin = async(req,res,next) => {
      // console.log('verify admin');
      const email = req.decoded.data.email;
      const user = await userCollection.findOne({email:email});
      // console.log(user);
      if(user.type!=='admin')res.status(401).send({error:true,message:'Unauthorized access:not admin'})
      next();
      
    }

    const verifyStudent = async(req,res,next) => {
      // console.log('verify admin');
      const email = req.decoded.data.email;
      const user = await userCollection.findOne({email:email});
      // console.log(user);
      if(user.type==='admin' || user.type==='instructor')res.status(401).send({error:true,message:'Unauthorized access:not admin'})
      // console.log(req.decoded)
      next();
      
    }

    const verifyInstructor = async(req,res,next) => {
      // console.log('verify admin');
      const email = req.decoded.data.email;
      const user = await userCollection.findOne({email:email});
      // console.log('instructor:',user);
      if(user.type!=='instructor')res.status(401).send({error:true,message:'Unauthorized access:not admin'})
      // console.log(req.decoded)
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

    app.post('/social-user',async (req,res)=>{{
      console.log('social in');
      const userData = req.body;
      console.log(userData);
      const user = await userCollection.findOne({email:userData.email});
      console.log(user);
      if(user){
        res.send({exist:true,message:'user exist in db'});
      }
      else{
        console.log('google in');
        const result = await userCollection.insertOne(userData);
        res.send(result);
      }
    }})


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
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    app.post('/classes',verifyJWT,async(req,res)=>{
      const _class = req.body;
      // console.log(_class);
      const result = classesCollection.insertOne(_class);
      res.send(result);
    });

    app.get('/classes/approved',async(req,res)=>{
      const result = await classesCollection.find({status:'approved'}).toArray();
      res.send(result);
    })

    app.get('/instructors',async(req,res)=>{
      const result = await userCollection.find({type:'instructor'}).toArray();
      res.send(result);
    })

    app.get('/classes/:id',verifyJWT,async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const result = await classesCollection.findOne({_id:new ObjectId(id)});
      // console.log('class',result);
      res.send(result);
    })

    app.put('/classes/:id/deny',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const { status, feedback } = req.body;

      const result = await classesCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status:status, feedback:feedback } },
        { returnOriginal: false }
      );

      res.send(result);
    })

    app.put('/classes/:id/approve',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const { status } = req.body;

      const result = await classesCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status } },
        { returnOriginal: false }
      );
      res.send(result);
    })

    app.put('/classes/:id/feedback',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const { feedback } = req.body;

      const result = await classesCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { feedback } },
        { returnOriginal: false }
      );
      res.send(result);
    })




    app.get('/top-instructors',async(req,res)=>{
      const result = await classesCollection.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'instructorEmail',
            foreignField: 'email',
            as: 'instructorDetails'
          }
        },
        {
          $unwind: '$instructorDetails'
        },
        {
          $group: {
            _id: '$instructorEmail',
            totalStudents: { $sum: { $ifNull: ['$enroll', 0] } },
            instructor: { $first: '$instructorDetails' }
          }
        },
        {
          $sort: { totalStudents: -1 }
        },
        {
          $limit: 6
        },
        {
          $project: {
            _id: 0,
            name: '$instructor.name',
            email: '$instructor.email',
            photoUrl: '$instructor.photoUrl',
            totalStudents: 1
          }
        }
      ]).toArray();

      res.send(result);
    })

    app.post('/enrollments',verifyJWT,verifyStudent,async(req,res)=>{
      let enrollment = req.body
      const {classId,userEmail} = enrollment;
      // console.log(enrollment);
      const present = await enrollmentsCollection.findOne({classId,userEmail});
      // console.log('present',present);

      if(present)return res.send({exist:true,message:'already wished'});

      const result = await enrollmentsCollection.insertOne(enrollment);
      res.send(result);
      // res.send({});
    })

    app.get('/wishlist',verifyJWT,verifyStudent,async(req,res)=>{
      const userEmail = req.decoded.data.email;
      // console.log(req.decoded.data);
      // console.log(userEmail);
      const result = await enrollmentsCollection.find({userEmail,enrollStatus:'wished'}).toArray();
      // console.log(result);
      res.send(result);
    })

    app.get('/enrollments/:id',verifyJWT,verifyStudent,async (req,res)=>{
      const id = req.params.id;
      console.log(id);
      const result = await enrollmentsCollection.findOne({_id:new ObjectId(id)});
      res.send(result);
    })
    app.delete('/enrollments/:id', verifyJWT, verifyStudent, async (req, res) => {
      const id = req.params.id;
      // console.log(new ObjectId(id));
      
      const result = await enrollmentsCollection.findOneAndDelete({ _id: new ObjectId(id) });

      res.send(result);
      // res.send({});
    });

    // app.get('/enrollments/:id',async(req,res)=>{
    //   const id = req.params.id;
    //   console.log(new ObjectId(id));
    //   const result = await enrollmentsCollection.findOne({_id:new ObjectId(id)});
    //   res.send(result);
    // })
    

    // app.post('/enrollments',verifyJWT,verifyStudent,async(req,res)=>{
    //   let enrollment = req.body
    //   const {classId} = enrollment;
    //   console.log(enrollment);
    //   const present = await enrollments.findOne({classId});
    //   console.log('present',present);
    //   // if(present)
    //   // const result = await enrollments.insertOne(enrollment);
    //   // res.send(result);
    //   res.send({});
    // })

  
    app.post("/create-payment-intent", async (req, res) => {
      let { price } = req.body;
      price = parseFloat(price.toFixed(2));
      const amount = Math.ceil(price*100);
      console.log(req.body);
      console.log('price : ',price);
      console.log('amount : ',amount);

    
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    app.put('/enrollments/:id', verifyJWT, async (req, res) => {
      const enrollmentId = req.params.id;
      // const { enrollStatus, transactionId } = req.body;
      // console.log(enrollStatus,transactionId,enrollmentId);
      const updatedData = req.body;
      console.log(updatedData);
    
      try {
        const enrollment = await enrollmentsCollection.findOne({ _id: new ObjectId(enrollmentId) });
        
        if (!enrollment) {
          console.log('Enrollment not found');
          return res.status(404).json({ message: 'Enrollment not found' });
        }
        
        const updateResult = await enrollmentsCollection.updateOne(
          { _id: new ObjectId(enrollmentId) },
          { $set: updatedData }
        );
    
        if (updateResult.modifiedCount === 1) {
          // Update the class document to reduce available seats by 1
          const classUpdateResult = await classesCollection.updateOne(
            { _id: new ObjectId(enrollment.classId) },
            { $inc: { availableSeats: -1 } }
          );
          
          if (classUpdateResult.modifiedCount === 1) {
            // Additional tasks after successful update and class update
            console.log('Enrollment updated successfully');
            res.json({ message: 'Enrollment updated successfully' });
          } else {
            console.log('Class not found');
            res.status(404).json({ message: 'Class not found' });
          }
        } else {
          console.log('Enrollment not found');
          res.status(404).json({ message: 'Enrollment not found' });
        }
      } catch (error) {
        console.error('Error updating enrollment:', error);
        res.status(500).json({ message: 'Error updating enrollment' });
      }
      // res.send({});
    });
    

    app.get('/enrolled-classes', verifyJWT, async (req, res) => {
      const userEmail = req.decoded.data.email;
    
      try {
        const enrolledClasses = await enrollmentsCollection.find({ userEmail, enrollStatus: 'enrolled' }).toArray();
        res.json(enrolledClasses);
      } catch (error) {
        console.error('Error retrieving enrolled classes:', error);
        res.status(500).json({ message: 'Error retrieving enrolled classes' });
      }
    });

    app.get('/payment-history', verifyJWT, verifyStudent, async (req, res) => {
      try {
        const enrollments = await enrollmentsCollection.find({
          userEmail: req.decoded.data.email,
          enrollStatus: "enrolled"
        }).sort({ paymentDate: -1 }).toArray();
    
        res.json(enrollments);
      } catch (error) {
        console.error('Error retrieving payment history:', error);
        res.status(500).json({ message: 'Error retrieving payment history' });
      }
    });


    app.get('/unique-classes', async (req, res) => {
      const uniqueClasses = await enrollmentsCollection.aggregate([
        {
          $group: {
            _id: {
              classId: "$classId",
              className: "$className",
              classImage: "$classImage"
            }
          }
        }
      ]).toArray();
  
      res.send(uniqueClasses);
    });


    app.get('/top-classes', async (req, res) => {
      try {
        const topClasses = await enrollmentsCollection.aggregate([
          {
            $match: {
              enrollStatus: "enrolled"
            }
          },
          {
            $group: {
              _id: {
                classId: "$classId",
                className: "$className",
                classImage: "$classImage"
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { count: -1 }
          },
          {
            $limit: 6
          },
          {
            $project: {
              _id: 0,
              classId: "$_id.classId",
              className: "$_id.className",
              classImage: "$_id.classImage",
              count: 1
            }
          }
        ]).toArray();
    
        res.json(topClasses);
      } catch (error) {
        console.error('Error retrieving top classes:', error);
        res.status(500).json({ message: 'Error retrieving top classes' });
      }
    });
    
    
    
    app.get('/instructors', async (req, res) => {
      const instructors = await userCollection.find({ type: 'instructor' }).toArray();
      res.send(instructors);
    });

    

    app.get('/instructor-all-classes-enroll',verifyJWT,verifyInstructor, async (req, res) => {
      const instructorEmail = req.decoded.data.email;
      console.log(instructorEmail)
      let allClasses = await classesCollection.find({ instructorEmail }).toArray();
    
      allClasses = await Promise.all(allClasses.map(async (cls) => {
        if (allClasses && cls.status === 'approved') {
          const enrolls = await enrollmentsCollection.countDocuments({ classId: cls._id.toString(), enrollStatus: 'enrolled' });
          cls.totalEnrolls = enrolls;
        }
        return cls;
      }));
      console.log(allClasses);
      res.send(allClasses);
    });

    
    
    
    app.get('/instructor-classes/:email', async (req, res) => {
      const { email } = req.params;
      // if(req.decoded.data.email!==email)res.status(401).send({error:true,message:'unauthorized access'});
      const instructorData = await userCollection.aggregate([
        {
          $match: { email: email, type: 'instructor' }
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'email',
            foreignField: 'instructorEmail',
            as: 'classes'
          }
        },
        {
          $unwind: '$classes'
        },
        {
          $match: { 'classes.status': 'approved' }
        },
        {
          $group: {
            _id: '$_id',
            name: { $first: '$name' },
            email: { $first: '$email' },
            photoUrl: { $first: '$photoUrl' },
            phoneNumber: { $first: '$phoneNumber' },
            gender: { $first: '$gender' },
            address: { $first: '$address' },
            type: { $first: '$type' },
            classes: { $push: '$classes' }
          }
        }
      ]).toArray();

      res.send(instructorData);
    });


    
    
    



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