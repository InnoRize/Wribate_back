import catchAsync from "../utils/catchAsync.js";
import userModel from "../models/userModel.js"
import { successMessage, ErrorResponse, successResponse } from "../utils/commonResponse.js"
import bcrypt from "bcryptjs"
import auth from "../controller/authController.js"
import sharp from "sharp";
import utils from "../controller/handleFactory.js"
import path from "path"
import { fileURLToPath } from 'url';
import fs from "fs"
import Categories from "../models/adminModel.js";
import moment from "moment";
import xlsx from "xlsx"
import handleFactory from "../controller/handleFactory.js";



const getOTP = catchAsync(async (req, res, next) => {
 const { body: { email } } = req
 const otp = 1234
 if (!email) return ErrorResponse(res, `Please enter vaild email`)
 await utils.contactUs(email, otp)
 await userModel.User.updateOne({ email: email },  // Find user by email
  { $set: { otp: otp } })
 successMessage(res, `OTP sent sucessfully`)
})

const verifyOTP = catchAsync(async (req, res, next) => {
 const { body: { email, otp } } = req
 const user = await userModel.User.findOne({ email: email })
 if (!user) return ErrorResponse(res, `Please select valid email`)
 if (user.otp !== otp) return ErrorResponse(res, `Please enter valid OTP`)
 successMessage(res, `OTP verified sucessfully`)
})

const signUpUser = catchAsync(async (req, res, next) => {
 const body = req.body
 const salt = await bcrypt.genSalt(10)
 const crypted = await bcrypt.hash(body.password, salt)
 const userData = {
  name: body.name, email: body.email, password: crypted
 }
 await userModel.User.create(userData)
 successMessage(res, `sign up completed`)

})

const loginUser = catchAsync(async (req, res, next) => {
 const { body: { email, password } } = req
 if (!email || !password) return ErrorResponse(res, 'Please enter valid email or Password')
 const user = await userModel.User.findOne({ email: email })
 if (!user) return ErrorResponse(res, 'User does not exists')
 const dbpassword = user.password
 const decode = await bcrypt.compare(password, dbpassword)
 if (!decode) return ErrorResponse(res, `Please enter valid email or password`)
 const token = await auth.jwtToken(user._id)
 res.status(200).json({ status: 1, token: token, message: "login successfully" })
})

const getProfile = catchAsync(async (req, res, next) => {
 const { user } = req
 const userDetails = await userModel.User.findById(user._id)
 const data = await utils.appendUrls(userDetails)
 console.log('data', data)
 successMessage(res, data)
})

const fileUpload = catchAsync(async (req, res, next) => {
 const file = req.file;
 console.log('file', file)
 const allowedMimeTypes = ['image/jpeg', 'image/png'];
 if (!allowedMimeTypes.includes(file.mimetype)) {
  return res.status(400).json({
   status: 0,
   message: 'Invalid file type. Only .jpeg or .png files are allowed.',
  });
 }

 // Extract the image_type from the request (e.g., query, body, or params)
 const imageType = req.body.image_type || req.query.image_type || 'default';
 const allowedTypes = ['users', 'wribte'];

 if (!allowedTypes.includes(imageType)) {
  return res.status(400).json({
   status: 0,
   message: 'Invalid image type. Allowed types are categories, subcategories, products, banners, and menus.',
  });
 }

 const uniqueFileName = `${file.originalname}`;
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);

 const uploadDir = path.join(__dirname, `uploads/${imageType}`);
 console.log('uploadDir', uploadDir)
 const uploadPath = path.join(uploadDir, uniqueFileName);

 if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
 }

 try {
  await sharp(file.buffer)
   .resize(800, 800, { fit: 'inside' })
   .toFormat('jpeg')
   .jpeg({ quality: 90 })
   .toFile(uploadPath);

  res.status(201).json({
   status: 1,
   message: 'File uploaded and processed successfully.',
   fileName: uniqueFileName,
  });
 } catch (sharpError) {
  return res.status(500).json({
   status: 0,
   message: 'Error processing image.',
   error: sharpError.message,
  });
 }
})

const updateProfile = catchAsync(async (req, res, next) => {
 const userId = req.params.id;
 const updateData = req.body; // Only update fields provided in the request

 if (Object.keys(updateData).length === 0) {
  return res.status(400).json({ message: 'No fields provided for update' });
 }

 const updatedUser = await userModel.User.findByIdAndUpdate(
  userId,
  { $set: updateData },
  { new: true, runValidators: true }
 );

 if (!updatedUser) return res.status(404).json({ message: 'User not found' });

 res.status(200).json({ message: 'User updated successfully', user: updatedUser });
})

const getCategories = catchAsync(async (req, res, next) => {
 const categories = await Categories.find()
 successResponse(res, categories)
})

const createWribate = catchAsync(async (req, res, next) => {
 const body = req.body
 const totalDuration = body.durationDays
 const startDate = body.startDate
 const { user: { _id } } = req

 const roundDurations = [
  Math.floor(totalDuration / 3), // First part
  Math.floor(totalDuration / 3), // Second part
  totalDuration - (2 * Math.floor(totalDuration / 3)) // Remaining days for last part
 ];

 let currentStartDate = moment(startDate);
 const rounds = roundDurations.map((days, index) => {
  const round = {
   roundNumber: index + 1,
   startDateTime: currentStartDate.toDate(),
   durationDays: days
  };
  currentStartDate.add(days, 'days'); // Move to the next round start date
  return round;
 });


 const wribateData = {
  title: body.title,
  coverImage: body.coverImage,
  startDate: startDate,
  durationDays: body.durationDays,
  leadFor: body.leadFor,
  leadAgainst: body.leadAgainst,
  supportingFor: body.supportingFor,
  supportingAgainst: body.supportingAgainst,
  judges: body.judges,
  category: body.category,
  institution: body.institution,
  scope: body.scope,
  type: body.type,
  prizeAmount: body.prizeAmount,
  rounds: rounds,
  createdBy: _id,
  wribateType: "single"
 }

 const newWribate = await userModel.Wribate.create(wribateData);
 console.log('newWribate', newWribate)
 successMessage(res, `New Wribate is created.`)
})

const getWribateByCategory = catchAsync(async (req, res) => {
 try {
  const { params: { category } } = req;

  // Fetch all wribates that match the given category
  const wribates = await userModel.Wribate.find({ category })
  if (wribates.length === 0) {
   return res.status(404).json({ status: "error", message: "No wribates found for this category" });
  }

  // Append baseURL to each coverImage
  const baseURL = process.env.USER
  const data = wribates.map(item => ({
   ...item._doc,
   coverImage: baseURL + item.coverImage
  }));

  res.status(200).json({ status: "success", data: data });
 } catch (error) {
  res.status(500).json({ status: "error", message: error.message });
 }
});

const getWribateByID = catchAsync(async (req, res) => {

 const { params: { id } } = req;

 // Fetch all wribates that match the given category
 const wribate = await userModel.Wribate.findById(id)
  .populate("comments") // Fetch related comments
  .populate("votes") // Fetch related votes
  .populate("arguments"); // Fetch related arguments

 if (wribate.length === 0) {
  return res.status(404).json({ status: "error", message: "No wribates found for this category" });
 }

 const now = new Date();
 const startDate = new Date(wribate.startDate);
 const endDate = new Date(startDate);
 endDate.setDate(startDate.getDate() + wribate.durationDays);

 // **Overall completion percentage**
 const totalDurationMs = endDate - startDate;
 const elapsedMs = now - startDate;
 const overallCompletion = Math.min((elapsedMs / totalDurationMs) * 100, 100);

 // **Find current round**
 let currentRound = null;
 let roundCompletion = 0;

 for (const round of wribate.rounds) {
  const roundStart = new Date(round.startDateTime);
  const roundEnd = new Date(roundStart);
  roundEnd.setDate(roundStart.getDate() + round.durationDays);

  if (now >= roundStart && now <= roundEnd) {
   currentRound = round.roundNumber;
   const roundElapsedMs = now - roundStart;
   const roundTotalMs = roundEnd - roundStart;
   roundCompletion = Math.min((roundElapsedMs / roundTotalMs) * 100, 100);
   break;
  }
 }

 const baseURL = process.env.USER
 wribate.coverImage = baseURL + wribate.coverImage

 res.status(200).json({
  status: "success", data: wribate,
  overallCompletion: overallCompletion.toFixed(2) + "%",
  currentRound: currentRound || "No active round",
  roundCompletion: currentRound ? roundCompletion.toFixed(2) + "%" : "N/A"
 });

});

const addArguments = catchAsync(async (req, res, next) => {
 const { params: { wribateId }, user, body: { text } } = req
 const userId = user._id

 console.log(user)
 // Fetch the wribate to check panel members
 const wribate = await userModel.Wribate.findById(wribateId);
 if (!wribate) {
  return res.status(404).json({ status: "error", message: "Wribate not found" });
 }

 console.log('wribate', wribate)

 //Check if the user is part of the panel
 const isPanelMember =
  wribate.leadFor === user.email ||
  wribate.leadAgainst === user.email ||
  wribate.supportingFor === user.email ||
  wribate.supportingAgainst === user.email;

 if (!isPanelMember) {
  return res.status(403).json({ status: "error", message: "Only panel members can add arguments" });
 }

 let panel = null;

 if (wribate.leadFor == user.email || wribate.supportingFor == user.email) {
  panel = "For";
 } else if (wribate.leadAgainst == user.email || wribate.supportingAgainst == user.email) {
  panel = "Against";
 }
 console.log('panel', panel)


 // Create and save the argument
 const argumentData = { wribateId: wribateId, userId: userId, panelSide: panel, text: text }
 const newArgument = new userModel.Argument(argumentData);
 await newArgument.save();

 // Update Wribate to link the argument
 await userModel.Wribate.findByIdAndUpdate(wribateId, { $push: { arguments: newArgument._id } });

 res.status(201).json({ status: "success", message: "Argument added", data: newArgument, panel: panel });


});

const addComment = catchAsync(async (req, res, next) => {

 const { body: { text }, params: { wribateId }, user: { _id } } = req;

 const newComment = new userModel.Comment({ wribateId: wribateId, userId: _id, text: text });
 await newComment.save();

 await userModel.Wribate.findByIdAndUpdate(wribateId, { $push: { comments: newComment._id } });

 res.status(201).json({ status: "success", message: "Comment added", data: newComment });

})

const addVotes = catchAsync(async (req, res, next) => {

 const { body: { vote }, user: { _id }, params: { wribateId } } = req; // "For" or "Against"

 const existingVote = await userModel.Vote.findOne({ wribateId, userId: _id });

 if (existingVote) {
  return res.status(400).json({ status: "error", message: "User has already voted" });
 }

 const newVote = new userModel.Vote({ wribateId, userId: _id, vote });
 await newVote.save();

 res.status(201).json({ status: "success", message: "Vote recorded", data: newVote });

});

const getMyWribates = catchAsync(async (req, res, next) => {
 const { user: { _id, email } } = req

 const wribates = await userModel.Wribate.find({
  $or: [
   { createdBy: userId }, // Matches createdBy
   { students: email } // Matches email in students array
  ]
 }).lean();
 //const wribates = await userModel.Wribate.find({ createdBy: _id })
 if (wribates.length === 0) {
  return res.status(404).json({ status: "error", message: "No wribates found for this user" });
 }

 // Append baseURL to each coverImage
 const baseURL = process.env.USER
 const data = wribates.map(item => ({
  ...item._doc,
  coverImage: baseURL + item.coverImage
 }));

 res.status(200).json({ status: "success", data: data });
})

const createBatchWribate = catchAsync(async (req, res) => {
 const { user: { _id } } = req
 const body = req.body
 const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
 const sheetName = workbook.SheetNames[0];
 const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
 const students = jsonData

 const transformedData = students.map(student => ({
  studentName: student["Student Name"],
  studentEmail: student["Email"],
  institution: body.institution,
 }));

 const insertedStudents = await userModel.Student.insertMany(transformedData);
 const ids = insertedStudents.map(student => student.studentEmail)
 const reversed = [...students].reverse();

 console.log('ids', ids)

 for (let i = 0; i < students.length / 2; i++) {

  const totalDuration = students[i]["Duration in Days"]
  const startDate = students[i]["Start Date"]

  const roundDurations = [
   Math.floor(totalDuration / 3), // First part
   Math.floor(totalDuration / 3), // Second part
   totalDuration - (2 * Math.floor(totalDuration / 3)) // Remaining days for last part
  ];

  let currentStartDate = moment(startDate);
  const rounds = roundDurations.map((days, index) => {
   const round = {
    roundNumber: index + 1,
    startDateTime: currentStartDate.toDate(),
    durationDays: days
   };
   currentStartDate.add(days, 'days'); // Move to the next round start date
   return round;
  });


  const wribateData = {
   title: students[i]["Category"],
   coverImage: students[i]["Cover Image"],
   startDate: students[i]["Start Date"],
   durationDays: students[i]["Duration in Days"],
   leadFor: students[i]["Student Name"],
   leadAgainst: reversed[i]["Student Name"],
   students: ids,
   supportingFor: "NA",
   supportingAgainst: "NA",
   judges: body.judge,
   category: students[i]["Category"],
   institution: body.institution,
   scope: "Open",
   type: "Free",
   prizeAmount: 0,
   rounds: rounds,
   createdBy: _id,
   wribateType: "batch"
  }

  const newWribate = await userModel.Wribate.create(wribateData);
 }

 res.json({ message: "File uploaded and data saved successfully!", data: jsonData });

 students.forEach(async (student) => {
  const studentName = student["Student Name"]
  const studentEmail = student["Email"]
  await handleFactory.sendInvitationMail(studentName, studentEmail)
 })

});

const deleteWribate = catchAsync(async (req, res, next) => {
 const result = await userModel.Wribate.deleteMany({}); // Deletes all documents in the collection
 console.log(`${result.deletedCount} Wribates deleted successfully`);
 successMessage(res, `deleted successfully`)
})


export default { signUpUser, loginUser, getProfile, getOTP, fileUpload, updateProfile, getCategories, createWribate, addArguments, getWribateByCategory, getWribateByID, addComment, addVotes, getMyWribates, createBatchWribate, verifyOTP, deleteWribate }

