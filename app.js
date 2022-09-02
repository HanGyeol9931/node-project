const express = require("express");
const bodyParser = require('body-parser');
const ejs = require("ejs");
const path = require("path");
const bcrypt = require('bcrypt');
const mysql = require("mysql2");
const img = require('./js/upload');
const cookie = require("cookie-parser")
const socketio = require("socket.io")
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const { sequelize, User, Post, Reply } = require("./model");
const { Script } = require("vm");
const app = express(); // express 설정1
// 서버 연결-------------------------------------------------
const server = app.listen(3000,()=>{
    console.log("서버가 열렸습니다.");
});
// app.js가 있는 위치 __dirname views 폴더까지의 경로가 기본값 렌더링할 파일을 모아둔 폴더
// app.set express에 값을 저장가능 밑에 구문은 views키에 주소값 넣은부분
app.set('views' , path.join(__dirname,"view")); // path.join함수는매개변수를 받은 문자열들을 주소처럼 합쳐줌 path.join("a","b") = a/b 주소처럼 만들어줌
//app.set('views' , path.join(__dirname,"view")); // path.join함수는매개변수를 받은 문자열들을 주소처럼 합쳐줌 path.join("a","b") = a/b 주소처럼 만들어줌
app.engine("html",ejs.renderFile); // engine("파일타입",ejs 그릴때 방식)
app.set("view engine", "html"); // 뷰 엔진 설정을 html을 랜더링 할때 사용 하겠다.
app.use(express.urlencoded({extended:false})); // body 객체 사용
app.use(express.static(__dirname)); // css경로
app.use(cookie());
app.use(express.static(path.join(__dirname,'/public'))); // 정적 파일 설정 (미들웨어) 3
app.use('/uploadimg',express.static(__dirname + '/uploadImg'));
app.use("/static", express.static(__dirname));
app.use(cookie());
const io = socketio(server);
app.use(bodyParser.urlencoded({extended:false})); // 정제 (미들웨어) 5
// 시퀄라이즈 구성 해보자 연결 및 테이블 생성 여기가 처음 매핑// sync 함수는 데이터 베이스 동기화 하는데 사용 필요한 테이블을 생성해준다.
// 필요한 테이블들이 다 생기고 매핑된다. 절대 어긋날 일이 없다.// 테이블 내용이 다르면 오류를 밷어냄 // 여기서 CREATE TABLE 문이 여기서 실행된다는것
app.use(
    session({
      secret: "mykey",
    })
  );

sequelize
.sync({force : false}) // force 강제로 초기화를 시킬것인지. (테이블 내용을 다 비워줄것인지)
.then(()=>{ // 연결 성공
    console.log("DB연결 성공")
})
.catch((err)=>{ // 연결실패 
    console.log(err)
});
app.get("/", (req,res)=>{  // 현재까지 메인인 log.html
    res.render("index");
});
//-------------------------------회원가입 및 비밀번호 암호화-------------------------------
app.post("/create",(req,res)=>{
    // create이 함수를 사용하면 해당 테이블에 컬럼을 추가할 수 있다.
    const { nickName, joinId, joinPassword }  = req.body;
    console.log(joinId)
    if((joinId && joinPassword) == ""){ 
        res.send('비밀번호를 입력해주세요.');
    }else{
        // bcrypt 활용 비밀번호 암호화
        bcrypt.hash(joinPassword, 10, (err,encrypted)=>{
            const create = User.create({  
                nickName : nickName,
                userPassword : encrypted,
                userId : joinId,
                userStop : 0,
                userWarning : 0,
                authority : "일반",
                // 위의 객체를 전달해서 컬럼을 추가할수있다.
            }).then((e)=>{ // 회원가입 성공 시
                res.send('회원가입을 축하합니다!');
            }).catch((err)=>{ // 회원 가입 실패 시 
                // console.log(err)
                res.send('중복된 아이디입니다');
            })
        })
    }
});
   
   
app.get("/", (req,res)=>{  // 현재까지 메인인 log.html
    res.render("index");
});
app.get("/mypage", (req,res)=>{  
    User.findOne({
        raw : true,
        where: {userId : req.cookies.user}
    })
    .then((e)=>{
        res.render("myPage",{data : e});
    })
    .catch(()=>{
        res.redirect("/")
    })
});

app.get("/index", (req,res)=>{  
    User.findOne({
        raw : true,
        where: {userId : req.cookies.user}
    })
    .then((e)=>{
        res.render("start",{data : e});
    })
    .catch(()=>{
        res.redirect("/")
    })
});


//------------------------------로그인 및 쿠키 생성--------------------------------------------
app.post('/index',(req,res)=>{    
    const userid = req.body.userId;
    const userpw = req.body.userPassword;
    User.findOne({
        raw : true,
        where : {userId:userid},
    }).then((e)=>{ // findOne을해서 담은 정보를 e에 넣음
        if((userid && userpw) == ""){ // 유저아이디와 패스워드가 공란이라면 
            res.send('<script type="text/javascript">alert("아이디와 비밀번호를 입력해주세요."); location.href="/";</script>');
        } else if(e===null){
            res.send('<script type="text/javascript">alert("없는정보입니다"); location.href="/";</script>');
        }
        else{
            const hashPassword = e.userPassword;
            bcrypt.compare(userpw, hashPassword, (err, same) => {
                if(same){
                    req.session.nickname = e.nickName
                    res.cookie("user",userid,{ // 로그인시 id로 쿠키만들기
                    expires : new Date(Date.now() + 900000),
                    httpOnly : true
                    });
                    res.render('start',{data : e});  
                }
                else{
                    res.send('<script type="text/javascript">alert("로그인 정보가 일치하지 않습니다."); window.location.href="/";</script>');
                }
            })
        }
    }).catch((err)=>{
        res.send(err);
    })
});
app.post("/nickname",(req,res)=>{
  const {nickname , name} = req.body
  console.log(nickname)
  console.log(name)
  User.update({  
      nickName : nickname, 
  },
  {
      where: {
          nickName : name,
      }
  }
  ).then((e)=>{
      res.send('good');  
  }).catch((err)=>{  
      console.log(err);
  });

})
//------------------------------------로그아웃-----------------------------------------------------
app.get('/logout', (req,res)=>{
    res.clearCookie("user");
    res.redirect("/");
})
//-------------------------------프로파일픽쳐저장------------------------------------------
app.post("/myPage",img.upload.single('file'),(req,res)=>{
    console.log(req.body.nickname)
    const nickname = req.body.nickname;
    const profilePicture = req.body.profilePicture;
    User.update({  
        nickName : req.body.chageNickname, 
        profilePicture : "uploadimg/" + req.file.originalname.replace('.PNG',"")
    },
    {
        where: {
            nickName : nickname,
        }
    }
    ).then((e)=>{
        res.render('myPage',{data : {nickName:e.nickName, profilePicture:e.profilePicture}});  
    }).catch((err)=>{  
        console.log(err);
    });
});
// 채팅방----------------------------------------------------
app.get("/chatting",(req,res)=>{
    User.findOne({
        raw : true,
        where: {userId : req.cookies.user}
    })
    .then((e)=>{
        res.render("chatting",{data : e});
    })
    .catch(()=>{
      res.redirect("/");
    })
})
// socketio-------------------------
const userArr = [];
const useridArr = [];
io.on("connection",(socket)=>{
    app.post("/userOut",(req,res)=>{
        const { nickname }   = req.body;
        User.findOne({
            raw : true,
            where : {nickName : nickname}
        })
        .then((e)=>{
            User.update({userStop : Number(e.userStop)+1},{where : {nickName : nickname}})
            io.to(useridArr[userArr.indexOf(nickname)]).emit("userOut",nickname)
            res.send(`${nickname}님이 강제퇴장 되었습니다.`)
        })
        .catch(()=>{
            console.log("err")
        })
    
    })
    // 유저떠날때
    socket.on('disconnect', () => {
        // 방떠나게 함
        io.emit("leaveRoom",userArr.splice(useridArr.indexOf(socket.id),1))
        // 유저 배열 제거
        useridArr.splice(useridArr.indexOf(socket.id),1)
        io.emit("userCount",userArr.length)
        io.emit("userShow",userArr)
        console.log("유저 떠남");
        console.log(userArr);
        if(userArr.length <= 0 ){
            io.emit("return")
        } 
        
    });
    console.log("유저 접속");
    
    socket.on("chat",(name,msg,socket)=>{
        // console.log(original)
        User.findOne({
            raw : true,
            where : {nickName : name}
        })
        .then((e)=>{
            if(e.authority == "관리자"){
                io.emit("adminChat",name,msg);
                return
            }
            else{
                io.emit("chat",name,msg);
            }
        })
        .catch((e)=>{
            console.log("err")
        })
    })
    socket.on("secretChat",(name,user,msg)=>{
        {
            io.to(user).emit("secretChat",name,user,msg);
            io.to(name).emit("secretChatYou",name,user,msg);
        }

    });
   socket.on("joinRoom",(name)=>{
        userArr.push(name);
        useridArr.push(socket.id);
        User.findOne({
            raw : true,
            where : {nickName : name}
        })
        .then((e)=>{
            if(e.authority == "관리자"){
                userArr.forEach((e)=>{
                    socket.join(e)
                    socket.join("관리자")
                })
                io.emit("userShow",userArr)
                io.emit("adminJoinRoom",name,userArr.length);
                return
            }
            else{
                io.emit("joinRoom",name,userArr.length);
                io.emit("userShow",userArr)
                socket.join(name);
            }
        })
        .catch((e)=>{
            console.log("err")
        })       
        console.log(userArr)
    });
});
app.post("/userWarning",(req,res)=>{
    const { nickname }   = req.body;
    User.findOne({
        raw : true,
        where : {nickName : nickname}
    })
    .then((e)=>{
        // console.log(Number(e.userWarning)+1)
        // User.update({userWarning : Number(e.userWarning)+1},{where : {nickName : nickname}})
        // res.send((Number(e.userWarning)+1)+"회 경고 입니다. 5회 이상 경고 시 퇴장입니다.")
        if(Number(e.userWarning) >= 4){
            User.update({userStop : Number(e.userStop)+1},{where : {nickName : nickname}})
            res.send("경고 초과로 강제 퇴장 되셨습니다.")
        }
        else{
            User.update({userWarning : Number(e.userWarning)+1},{where : {nickName : nickname}})
            res.send((Number(e.userWarning)+1)+"회 경고 입니다. 5회 이상 경고 시 퇴장입니다.")
        }
    })
    .catch((e)=>{
        console.log("err")
        console.log(e)
        res.send("에러남")
    })
})

// -----------------------------------게시판----------------------------------------
// 글 목록 보여주는 페이지
app.get("/board", (req, res) => {
    res.render("board");
  });

// 게시판 목록
app.post("/board", (req, res) => {
    Post.findAll().then((datas) => {
      res.send(datas);
    });
  });

// 글쓰기 페이지
app.get("/write", (req, res) => {
  const name = req.session.nickname;
  res.render("write", { writer : name});
  });
  
//글쓰기 데이터 보내기
app.post("/write", (req, res) => {
  const name = req.session.nickname;
  const { title, content } = req.body;
  if(title === '' || content === ''){
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.write("<script>alert('내용을 입력해주세요')</script>")
    res.write('<script>window.location="/board"</script>');
  } else{ 
  Post.create({
    title,
    content,
    writer: name,
  })
    .then((e) => {
      res.redirect("board");
    })
    .catch((err) => {
      console.log(err);
    });
  }
});

// 글 보여주기
app.get("/board/:id", function (req, res) {
  let postID = req.params.id;
  Post.findOne({
    raw: true,
    where: { postId: postID },
  })
    .then((result) => {
      Reply.findAll({
        where : {
          postId : postID
        }
      }).then((el)=>{
          res.render("post", {
            Post: result,
            Reply : el,
            User : req.session.nickname
        })
    })
    .catch((err) => {
      console.log(err);
    });
});
});

// 수정하기 페이지
// 글쓴 사람만 수정할 수 있음
app.get("/edit/:id", (req, res) => {
  let postID = req.params.id;
  req.session.postId = req.params.id;
  res.render("edit", {
    postID: postID,
  });
});

// 수정하기
app.post("/edit/:id", (req, res) => {
  const { title, content } = req.body;
  if(title === '' || content === ''){
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.write("<script>alert('내용을 입력해주세요')</script>")
    res.write('<script>window.location="/board"</script>');
  } else{
  let postID = req.params.id;
      Post.update(
    {
      title: title,
      content: content,
    },
    {
      where: { postId: postID },
    }
  );
  res.redirect("/board"); 
  }
});
    
//글 삭제하기
app.get("/del/:id", (req, res) => {
  let postID = req.params.id;
  Post.destroy({
    where: {
      postId: postID,
    },
  })
    .then(() => {
      res.render("board", {
        postID: postID,
      });
    })
    .catch(() => {
      console.log(err);
    });
});

// 댓글
app.get("/reply/:id",(req,res) => {
  res.render('post')
})

// 댓글 등록하기
app.post("/reply/:id", (req, res) => {
  let postID = req.params.id;
  const name = req.session.nickname;
  const { replyContent } = req.body;
  if(replyContent === ''){
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.write("<script>alert('내용을 입력해주세요')</script>")
    res.write('<script>window.location="/board"</script>');
  } else{
    Reply.create({
      postId: postID,
      content: replyContent,
      writer: name,
    })
      .then(() => {
        Post.findOne({
          raw: true,
          where: { postId: postID },
        })
          .then((e) => {
            Reply.findAll({
              where : {
                postId : postID
              }
            })
            .then((a)=>{
              res.render("post", {Post: e, Reply : a, User : req.session.nickname});
            })
          })
          .catch((err) => {
            console.log(err);
          });
  
      })
    }
});

// 댓글 삭제
app.get("/del_reply/:id/:co", (req, res) => {
  let replyID = req.params.id;
  let postID = req.params.co;
  const {abo} = req.body
  Reply.destroy({
    raw : true,
    where: {
      replyId: replyID,
    },
  })
    .then((e) => {
      console.log(abo)
      Post.findOne({
        raw: true,
        where: { postId: postID },
      })
        .then((e) => {
          Reply.findAll({
            where : {
              postId : postID
            }
          })
          .then((a)=>{
            res.render("post", {Post: e, Reply : a,User : req.session.nickname});
          })
        })
        .catch((err) => {
          console.log(err);
        })
    })
});