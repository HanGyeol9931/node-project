const dot = require("dotenv").config();

// 데이터 베이스 접속에 필요한 설정값 객체
const config = {
  dev: {
    username: "honeybee",
    password: "99319931",
    database: "honeybee",
    host: "127.0.0.1", // 여기에 만약 우리가 AWS RDS 쓰거나 지원 데이터 베이스 등등
    // 사용을 한다면 이곳에 주소를 넣어주면 됩니다.
    dialect: "mysql",
    dialectOptions: {
      dateStrings: true,
      typeCast: true,
    },
    define: {
      timestamps: true,
    },
  },
};

module.exports = config;
