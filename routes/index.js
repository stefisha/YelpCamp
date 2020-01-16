var express = require('express');
var router = express.Router();
var passport = require('passport');
var user = require('../models/user');
var campground = require('../models/campground');

//root route

router.get('/', function(req, res) {
	res.render('landing');
});

// register form foute

router.get('/register', function(req, res) {
	res.render('register');
});

// handle sign up logic

router.post('/register', function(req, res) {
	var newUser = new user({ username: req.body.username });
	user.register(newUser, req.body.password, function(err, user) {
		if (err) {
			req.flash('error', err.message);
			return res.render('register');
		}
		passport.authenticate('local')(req, res, function() {
			req.flash('success', 'Welcome to YelpCamp!' + user.username);
			res.redirect('/campgrounds');
		});
	});
});

// show login form

router.get('/login', function(req, res) {
	res.render('login');
});

//handling login form

router.post(
	'/login',
	passport.authenticate('local', {
		successRedirect: '/campgrounds',
		failureRedirect: '/login'
	}),
	function(req, res) {}
);

// logout

router.get('/logout', function(req, res) {
	req.logout();
	req.flash('success', 'Logged you out!');
	res.redirect('/campgrounds');
});

//api

// prikazi sve kampove

router.get('/api', function(req, res) {
    campground.find({}, function(err, allCampgrounds) {
        if (err) {
            console.log(err);
        } else {
            res.render('api', { campgrounds: allCampgrounds, currentUser: req.user });
        }
    });
});

//ubacivanje kampa

//http://localhost:3000/api?name=ime&image=https://ddl.rs/wp-content/uploads/2019/08/maldivi-plaza-insta.jpg&price=200&description=opis
router.post('/api', function(req, res) {
    var name = req.param("name");
    var image = req.param("image");
    var price = req.param("price");
    var desc = req.param("description");
    var author = {
        id: "5e077c74271b530017fa35fa",
        username: "milos97"
    };
    var newCampground = { name: name, price: price, image: image, description: desc, author: author };
    // create a new campground and save to database
    campground.create(newCampground, function(err, newlyCreated) {
        if (err) {
            console.log(err);
        } else {
            console.log(newlyCreated);
            //res.redirect('/campgrounds');
        }
    });
    res.status(200).json({status:"ok"});
});

//update
//http://localhost:3000/api/5e207ad4e4bb3313e083690e?name=plaza&price=300&description=proba&image=d
router.put('/api/:id', function(req, res) {
    campground.findByIdAndUpdate(req.params.id,
         {
            name: req.param("name"),
            price: req.param("price"),
            image: req.param("image"),
            description: req.param("description")
        }
        
    , function(err, updaedCampground) {
        if (err) {
            res.status(500).json({status:"error"});
        } else {
            res.status(200).json({status:"ok"});
        }
    });

});

//delete

router.delete('/api/:id', function(req, res) {
    campground.findByIdAndRemove(req.params.id, function(err) {
        if (err) {
            res.status(500).json({status:"error"});
        } else {
            res.status(200).json({status:"ok"});
        }
    });
});




module.exports = router;
