'use strict';

const functions = require('firebase-functions');
const request = require('request-promise');
const admin = require('firebase-admin');
admin.initializeApp();

// const WEBHOOK_URL = 'https://9bca0d72c05e34bd1f3a89d9487d9471.m.pipedream.net';
const WEBHOOK_URL = 'https://api.gumroad.com/v2/licenses/verify';

var docId;
const db = admin.firestore();

exports.newUser = functions.https.onRequest(async (req, res) => {
  const fname = req.query.fname;
  const lname = req.query.lname;
  const serialNum = req.query.serialNum;
  const email = req.query.email;
  const verified = false;
  const error = false;
  const errormessage = "";
  const writeResult = await db.collection('users').add({
    fname: fname,
    lname: lname,
    serialNum: serialNum,
    email: email,
    verified: verified,
    error: error,
    errormessage: errormessage
  });
  res.json({ result: `User with ID: ${writeResult.id} added.` });
});

exports.verifyPurchase = functions.firestore
  .document('/users/{documentId}')
  .onCreate(async (snapshot, context) => {
    const docId = context.params.documentId;
    console.log(`DocID: ${docId}`)
    const docref = db.collection('users').doc(docId);

    const license_key = snapshot.data().serialNum;
    const userEmail = snapshot.data().email;

    const response = await request({
      uri: WEBHOOK_URL,
      method: 'POST',
      json: true,
      body: { product_permalink: "searcher", license_key: license_key },
      resolveWithFullResponse: true,
    }).catch(e => {
      console.log(e.error);
      docref.update({
        verified: false,
        error: true,
        errormessage: "Could not verify license key. Please contact GumRoad support to obtain a valid license key."
      })
        .then((result) => {
          console.log(`Result of action: ${result}`)
        })
        .catch(error => console.log(error));
      process.exit(1)
    });

    if (response.statusCode >= 400) {
      console.log("Error: Could not connect to Gumroad purchase verification API.");
      throw new Error(`HTTP Error: ${response.statusCode}`);

    }
    console.log('SUCCESS! Purchase?', response.body.success);
    if (response.body.success) {
      console.log(`RESPONSE: EMAIL: ${response.body.purchase.email}`);
      if (response.body.purchase.email == userEmail) {
        docref.update({ verified: true, email: response.body.purchase.email })
          .then((result) => { console.log(`Result of action: ${result}`) })
          .catch(error => console.log(error));
      } else {
        console.log("Incorrect email address. Please enter the email address used when purchasing from Gumroad.");
      }
    } else {
      docref.update({
        verified: false,
        error: true,
        errormessage: "Could not verify license key. Please contact GumRoad support to obtain a valid license key."
      })
        .then((result) => { console.log(`Result of action: ${result}`) })
        .catch(error => console.log(error));
    }
  });
