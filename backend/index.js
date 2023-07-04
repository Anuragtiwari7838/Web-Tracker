const express = require("express");
const cors =require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
const axios=require("axios");
const nodemailer=require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const userRoutes = require('./app/User/UserRoutes');
const webRoutes = require('./app/Website/WebsiteRoutes');
const WebsiteSchema = require("./app/Website/WebsiteSchema");

const app = express();

app.use(cors());
app.use(express.json());

app.use(userRoutes);
app.use(webRoutes);

const transport = nodemailer.createTransport({
    service:"gmail",
    auth:{
        user: process.env.G_EMAIL,
        pass:process.env.G_PASSWORD,
    }
});

const isSiteActive = async (url) => {
    if(!url) return false;

    const res=await axios.get(url).catch(err=>void err)

    if(!res || res.status !==200) return false;

    return true;
}

cron.schedule("0 */1 * * *",async () => {
    console.log('con ran')
    const allWebsites=await WebsiteSchema.find({}).populate({
        path: "userId",
        select: ["name", "email"],
    });
    if(!allWebsites) return;

    for(let i=0;i<allWebsites.length; ++i){
        const website=allWebsites[i];
        const url=website.url;

        const isActive=await isSiteActive(url);
        WebsiteSchema.updateOne(
            {_id: website._id },
            {
                isActive,
            }
        ).exec();

        console.log("checking website", website.url);
        if(!isActive && website.isActive){
            transport.sendMail({
                from: process.env.G_EMAIL,
                to: website.userId.email,
                subject: "Your website has gone down , Please have a look",
                html: 'Your website - <b>${website.url}</b> is down. As we checked on ${new Date().toLocalString("en-in")}',
            })
            // send email to the user
        }
    }

});

app.listen(5000, () => {
    console.log('Backend is up at port 5000');

    mongoose.set("strictQuery", true);
    mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("Established a connection with the database"))
    .catch(err=>console.log("Error connecting to database", err));
})