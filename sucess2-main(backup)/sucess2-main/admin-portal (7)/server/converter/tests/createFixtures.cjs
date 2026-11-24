const fs = require('fs');
const path = require('path');

const fixturesDir = path.resolve(__dirname, '../../data/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. CSV Student List
const csvStudents = `Sl.No,Candidate Name,Registration Number,Birth Date,Class,Semester
1,Aakash Sharma,4MT21CS001,15-08-2003,A,5
2,Bhavana Rao,4MT21CS002,22-11-2002,A,5
3,Chetan Kumar,4MT21CS003,10-04-2003,B,5
4,Deepa M,4MT21CS004,05-01-2004,B,5
5,Aakash Sharma,4MT21CS001,15-08-2003,A,5`; // deliberate duplicate USN
fs.writeFileSync(path.join(fixturesDir, 'students_sample.csv'), csvStudents, 'utf8');

// 2. TXT Student List
const txtStudents = `Maharaja Institute of Technology Mysore
Department of Computer Science & Engineering
Student Roster - Semester 5

1.   4MT21CS010   Eshwar Prasad      12-05-2003   Sec A
2.   4MT21CS011   Farhan Akhtar      25-09-2002   Sec A
3.   4MT21CS012   Gowri Shankar      19-01-2003   Sec B
4.   4MT21CS013   Harini Reddy       08-07-2003   Sec B`;
fs.writeFileSync(path.join(fixturesDir, 'students_sample.txt'), txtStudents, 'utf8');

// 3. TXT Question Paper
const txtQp = `Subject: Computer Networks (21CS51)
Department: CSE | Semester: 5

MODULE 1
1. What is the standard header length of an IPv4 packet?
(A) 20 bytes
(B) 40 bytes
(C) 64 bytes
(D) 128 bytes
Answer: A

2. Which protocol is primarily used for mapping an IP address to a MAC address?
(A) DNS
(B) ARP
(C) DHCP
(D) ICMP
Answer: B

MODULE 2
3. Which transport layer protocol provides connection-oriented and reliable byte stream delivery?
(A) UDP
(B) TCP
(C) IP
(D) ICMP
Answer: B`;
fs.writeFileSync(path.join(fixturesDir, 'question_paper_sample.txt'), txtQp, 'utf8');

// 4. CSV Question Paper
const csvQp = `Sl.no.,Questions,option A,option B,option C,option D,Key Answer,Module
1,What does HTTP stand for?,Hyper Text Transfer Protocol,High Transfer Text Protocol,Hyper Text Transmission Protocol,Hyperlink Transport Protocol,A,1
2,Which layer in OSI model performs encryption?,Transport Layer,Presentation Layer,Session Layer,Application Layer,B,1
3,Which port is used by default for HTTPS?,80,8080,443,22,C,2`;
fs.writeFileSync(path.join(fixturesDir, 'question_paper_sample.csv'), csvQp, 'utf8');

// 5. Empty file (0 bytes)
fs.writeFileSync(path.join(fixturesDir, 'empty_file.pdf'), Buffer.alloc(0));

// 6. Corrupt binary disguised as TXT
fs.writeFileSync(path.join(fixturesDir, 'corrupted_disguised.txt'), Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x02]));

// 7. Unsupported file format
fs.writeFileSync(path.join(fixturesDir, 'unsupported.exe'), Buffer.from('MZ\x90\x00\x03\x00\x00\x00'));

// 8. Copy one DOCX file if available
const tempDocx = path.resolve(__dirname, '../../uploads/temp/1794974386101_bfz1hh_LDCO_MCQ_Question_Bank.docx');
if (fs.existsSync(tempDocx)) {
  fs.copyFileSync(tempDocx, path.join(fixturesDir, 'sample_questions.docx'));
  console.log('DOCX sample copied to fixtures');
}

console.log('Test fixtures created successfully in:', fixturesDir);
