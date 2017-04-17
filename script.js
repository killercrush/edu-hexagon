var game = new Phaser.Game(
    600, 
    600, 
    Phaser.CANVAS, 
    'view-container', 
    { 
        preload: preload, 
        create: create, 
        update: update, 
        render: render 
    }
);

function preload() {
    var debugToggle = document.getElementById("debugToggle");
    debugToggle.addEventListener("change", function () {
        drawDebugLines = debugToggle.checked;
    });
}

var maxRadius;
var Cx;
var Cy
var ECLength;
var WCLength;
var speed;

var balls;
var agents;
var hexagons;
var normal;


//debug
var drawDebugLines = false;
var obstacleLines;
var targetLine;
var obstacleLine;
var obstacleLine2;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rotatePoint(x0, y0, x, y, a) {
    var rad = a * Math.PI / 180;
    return {
        x: x0 + (x - x0) * Math.cos(rad) - (y - y0) * Math.sin(rad),
        y: y0 + (y - y0) * Math.cos(rad) + (x - x0) * Math.sin(rad)
    }
}
function inCircle(x, y, R) {
    var dx = Math.abs(x - Cx);
    var dy = Math.abs(y - Cy);
    return ( dx * dx + dy * dy < R * R );
}


function Hexagon(radius, missingSide, color) {
    this.radius = radius;
    this.color = color;
    this.missingSide = missingSide;
    this.lines = [];
    this.update = function () {
        this.radius -= speed;
        if (this.radius < 10) {
            this.radius = maxRadius;
            var rnd = getRandomInt(0, 5);
            while (rnd != this.missingSide)
                this.missingSide = getRandomInt(0, 5);
        }
        this.lines = [];
        var nextX = Cx + this.radius * Math.cos(0);
        var nextY = Cy + this.radius * Math.sin(0);
        var lines = [];
        for (var side = 1; side < 7; side++) {
            var prevX = nextX;
            var prevY = nextY;
            nextX = Cx + this.radius * Math.cos(side * 2 * Math.PI / 6);
            nextY = Cy + this.radius * Math.sin(side * 2 * Math.PI / 6);
            this.lines.push( new Phaser.Line( prevX, prevY, nextX, nextY ) );
        }
    }
    this.draw = function () {
        this.lines.forEach(function (line, idx){
            if (idx != this.missingSide)
                game.debug.geom(line, this.color);
        }, this);
    }
}

function Agent(obj) {
    this.object = obj;
    this.searchWallTimer = 0;
    this.searchExitTimer = 0;
    this.run = false;
    this.target = new Phaser.Point(300, 300);
    this.obstaclePoints = [];
    this.obstaclePoint;

    this.lookAround = function (argument) {
        hexagons.some(function (hxg) {
            for (var a = 15; a < 360; a += 15) {
                var pt = rotatePoint( this.object.body.x, this.object.body.y, this.object.body.x, this.object.body.y - ECLength, a );
                var line = new Phaser.Line( this.object.body.x, this.object.body.y, pt.x, pt.y );
                var intersectPoint = line.intersects(hxg.lines[hxg.missingSide], true);

                if ( intersectPoint ) {
                    var center = hxg.lines[hxg.missingSide].midPoint();
                    normal = new Phaser.Line(0, 0, 0, 0);
                    normal.fromAngle(center.x, center.y, hxg.lines[hxg.missingSide].normalAngle, 50);
                    this.target = new Phaser.Point(normal.end.x, normal.end.y);
                    return true;
                }
            }            
        }, this);

        this.obstaclePoints = [];
        minLength = 99999;
        this.obstaclePoint = false;

        hexagons.forEach(function (hxg) {
            var lines = hxg.lines;
            for (var i = 0; i < 6; i++) {
                if (i == hxg.missingSide) continue;
                for (var a = 0; a < 360; a += 30) {
                    var pt = rotatePoint( this.object.body.x, this.object.body.y, this.object.body.x, this.object.body.y - WCLength, a );
                    var line = new Phaser.Line( this.object.body.x, this.object.body.y, pt.x, pt.y );
                    var intersectPoint = line.intersects(lines[i], true);

                    if ( intersectPoint ) {
                        this.obstaclePoints.push(intersectPoint);
                        var d = Phaser.Math.distance(this.object.body.x, this.object.body.y, intersectPoint.x, intersectPoint.y);
                        if ( d < minLength) {
                            minLength = d;
                            this.obstaclePoint = intersectPoint;
                        }
                    }
                }
            }
        }, this);
    }

    this.move = function (argument) {
        if (this.target &&
            Math.abs(this.object.body.x - this.target.x) < 15 &&
            Math.abs(this.object.body.y - this.target.y) < 15) {
            this.target = false;
        }
        if (this.target) {
            this.object.body.velocity = new Phaser.Point(this.target.x - this.object.body.x, this.target.y - this.object.body.y);
        }
        else {
            this.object.body.velocity = new Phaser.Point(0, 0);
        }
        if (this.obstaclePoint) {
            var angle = Phaser.Math.angleBetween(this.object.body.x, this.object.body.y, this.obstaclePoint.x, this.obstaclePoint.y);
            var line = new Phaser.Line(0, 0, 0, 0);
            line.fromAngle(this.object.body.x, this.object.body.y, angle - Math.PI, 50);
            var d = Phaser.Math.distance(this.object.body.x, this.object.body.y, this.obstaclePoint.x, this.obstaclePoint.y);
            var m = this.target ? (WCLength - d) / WCLength : 1;
            this.object.body.velocity.x += (line.end.x - this.object.body.x) * m;
            this.object.body.velocity.y += (line.end.y - this.object.body.y) * m;
            //console.log((line.end.x - this.object.body.x), (line.end.y - this.object.body.y), m);
        }
    }

}
function create() {

    game.stage.backgroundColor = '#124184';

    var bounds = new Phaser.Rectangle(280, 320, 40, 40);

    game.physics.startSystem(Phaser.Physics.ARCADE);

    //game.physics.p2.restitution = 0.9;
    balls = game.add.physicsGroup(Phaser.Physics.ARCADE);
    var drawnObject;
    var width = 8;
    var height = 8;
    var bmd = game.add.bitmapData(width, height);
     
    bmd.ctx.fillStyle = '#ee1111';     
    bmd.ctx.beginPath();    
    bmd.ctx.arc(4, 4, 4, 0, Math.PI*2, true);      
    bmd.ctx.closePath();        
    bmd.ctx.fill();

    agents = [];
    for (var i = 0; i < 10; i++)
    {
        var ball = balls.create(bounds.randomX, bounds.randomY, bmd);
        ball.body.setCircle(4);
        ball.body.maxVelocity = new Phaser.Point(90, 90);
        //ball.body.bounce = new Phaser.Point(1, 2);
        agents.push( new Agent(ball) );
    }

    hexagons = [];
    hexagons.push( new Hexagon(700, 4, "rgb(255,255,255)") ); 
    hexagons.push( new Hexagon(600, 4, "rgb(255,255,255)") );        
    hexagons.push( new Hexagon(500, 0, "rgb(255,255,255)") );
    hexagons.push( new Hexagon(400, 2, "rgb(255,255,255)") );
    hexagons.push( new Hexagon(300, 4, "rgb(255,255,255)") );    
    maxRadius = 500;
    Cx = 300;
    Cy = 300;
    speed = 0.8;
    ECLength = 100;
    WCLength = 100;

}

function update() {

    game.physics.arcade.collide(balls);
    hexagons.forEach(function(hexagon) {
        hexagon.update();
    });
    agents.forEach(function(agent) {
        agent.lookAround();
        agent.move();
    }, this);

    if (drawDebugLines) {
        // obstacleLines = [];
        // agents[0].obstaclePoints.forEach(function (pt) {
        //     var ln = new Phaser.Line(agents[0].object.body.x, agents[0].object.body.y, pt.x, pt.y);
        //     obstacleLines.push(ln);
        // });
        targetLine = false;
        if (agents[0].target)
            targetLine = new Phaser.Line(agents[0].object.body.x, agents[0].object.body.y, agents[0].target.x, agents[0].target.y);
        
        obstacleLine = false;

        if (agents[0].obstaclePoint) {
            var angle = Phaser.Math.angleBetween(agents[0].object.body.x, agents[0].object.body.y, agents[0].obstaclePoint.x, agents[0].obstaclePoint.y);
            obstacleLine = new Phaser.Line(0, 0, 0, 0);
            obstacleLine.fromAngle(agents[0].object.body.x, agents[0].object.body.y, angle - Math.PI, 50);
            obstacleLine2 = new Phaser.Line(agents[0].object.body.x, agents[0].object.body.y, agents[0].obstaclePoint.x, agents[0].obstaclePoint.y);  
        }        
    } else {
        targetLine = false;
        obstacleLine = false;
    }
}

function render() {
    hexagons.forEach(function(hexagon) {
        hexagon.draw();
    });
    // obstacleLines.forEach(function (line, idx) {
    //     game.debug.geom(line, 'rgb(255,0,0)');
    // } );    

    if (targetLine)
        game.debug.geom(targetLine, 'rgb(0,255,0)');
    if (obstacleLine) {
        game.debug.geom(obstacleLine, 'rgb(255,0,0)');
        game.debug.geom(obstacleLine2, 'rgb(0,192,192)');       
    }
    
     // game.debug.lineInfo(line1, 32, 32);
     // game.debug.lineInfo(line2, 32, 100);
}