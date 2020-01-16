var express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	mongoose = require('mongoose'),
	campground = require('./models/campground'),
	comment = require('./models/comment'),
	methodOverride = require('method-override'),
	passport = require('passport'),
	localtStrategy = require('passport-local'),
	user = require('./models/user'),
	flash = require('connect-flash');

//requring routes

var commentRoutes = require('./routes/comments'),
	campgroundroutes = require('./routes/campgrounds'),
	authRoutes = require('./routes/index');

//mongoose.connect(process.env.DATABASEURL, { useUnifiedTopology: true, useNewUrlParser: true });

// mongoose.connect('mongodb://localhost:27017/yelp_camp', { useUnifiedTopology: true, useNewUrlParser: true });

mongoose.connect('mongodb+srv://stefan:cira@yelpcamp-sirz8.mongodb.net/test?retryWrites=true&w=majority', {
 	useUnifiedTopology: true,
 	useNewUrlParser: true
 });

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(flash());

app.use(
	require('express-session')({
		secret: 'Secret message!',
		resave: false,
		saveUninitialized: false
	})
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localtStrategy(user.authenticate()));
passport.serializeUser(user.serializeUser());
passport.deserializeUser(user.deserializeUser());

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash('error');
	res.locals.success = req.flash('success');
	next();
});

app.use('/', authRoutes);
app.use('/campgrounds/:id/comments', commentRoutes);
app.use('/campgrounds', campgroundroutes);

const port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log('YelpCamp Server has started!');
});
