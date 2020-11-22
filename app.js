require("dotenv").config();
const express = require("express");
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");
app.use(bodyparser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(
    session({
        secret: "Imanewdeveloper",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());
mongoose.connect(process.env.MONGODB_ATLAS_CONNECTION_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true);


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("user", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://secrets-apps.herokuapp.com/auth/google/sun",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        { googleId: profile.id, name: profile._json.name },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/secrets", function(req, res){
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
        if (err){
            console.log(err);
        } else {
            if (foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile"],
    })
);

app.get(
    "/auth/google/sun",
    passport.authenticate("google", {failureRedirect: "/login"}),
    function (req, res) {
        res.redirect("/secrets");
    }
);

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const userId = req.user._id;
    console.log(userId)
    const submittedSecret = req.body.secret;
    console.log(submittedSecret)
    User.findById(userId, function (err,foundUser) {
        if(!err) {
            if (foundUser) {
                console.log(foundUser)
                foundUser.secret=submittedSecret;
                foundUser.save(function (){
                    res.redirect("/secrets");
                })
            }
        }
    });
});

app.post("/register", function(req, res){
    console.log(req.body.username);
    console.log(req+"body")
    console.log(req.body.password);
    User.register(new User({username: req.body.username}), req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.render("register");
        }
        passport.authenticate("local")(req, res, function(){
            res.redirect("/secrets");
        });
    });
});


app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.login(user, function (err) {
        if (!err) {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/submit");
            });
        } else {
            res.redirect("/register");
        }
    });
});

app.get("/logout", function (req, res) {
    req.logOut();
    res.redirect("/");
});

app.listen(process.env.PORT || 3000, function () {
    console.log("server started at 3000");
});