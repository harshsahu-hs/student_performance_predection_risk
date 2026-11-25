const bcrypt = require('bcrypt');
const pw = 'HARSHSAHUKUMAR922';
const hash = '$2b$12$4RT1iKB5V1oRCznbgt3DfeOkH02RxP5WHYGBumDSIAg4X0SrSYvAK';
console.log('Password:', pw);
console.log('Hash:', hash);
console.log('Match:', bcrypt.compareSync(pw, hash));