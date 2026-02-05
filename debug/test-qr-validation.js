/**
 * QR Validation Diagnostic Test
 * Tests if EDU- prefix validation works correctly
 */

// Mock the STUDENT_ID_FORMAT from config
const STUDENT_ID_FORMAT = {
  PREFIX: "EDU",
  YEAR_LENGTH: 4,
  LRN_LENGTH: 4,
  SEQ_LENGTH: 4,
  PATTERN: /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
  PARSE_PATTERN: /^EDU-(\d{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/
};

// Current parseStudentID function (from scan-actions.js)
function parseStudentID_current(qrCode) {
  const qr = String(qrCode ?? "").trim().toUpperCase();
  
  if (!qr) {
    return { valid: false, error: "QR code is empty" };
  }
  
  // Validate using pattern from config
  const pattern = STUDENT_ID_FORMAT.PARSE_PATTERN;
  const match = qr.match(pattern);
  
  if (!match) {
    return { 
      valid: false, 
      error: `Invalid QR format: expected ${STUDENT_ID_FORMAT.PREFIX}-YYYY-${STUDENT_ID_FORMAT.LRN_LENGTH}${STUDENT_ID_FORMAT.SEQ_LENGTH}-XXXX` 
    };
  }
  
  const [, year, last4Lrn, sequence] = match;
  const fullStudentId = `${STUDENT_ID_FORMAT.PREFIX}-${year}-${last4Lrn}-${sequence}`;
  
  return {
    valid: true,
    studentId: fullStudentId,
    year: year,
    last4Lrn: last4Lrn,
    sequence: sequence,
    error: null
  };
}

// Test cases
const testCases = [
  { qr: "EDU-2025-1234-0001", desc: "Valid EDU QR", expectValid: true },
  { qr: "INVALID-2025-1234-0001", desc: "Wrong prefix 'INVALID'", expectValid: false },
  { qr: "2025-1234-0001", desc: "No prefix at all", expectValid: false },
  { qr: "edu-2025-1234-0001", desc: "Lowercase edu", expectValid: false },
  { qr: "XYZ-2025-1234-0001", desc: "Random prefix 'XYZ'", expectValid: false },
  { qr: "", desc: "Empty QR", expectValid: false },
  { qr: "   ", desc: "Whitespace only", expectValid: false },
  { qr: null, desc: "Null QR", expectValid: false },
  { qr: "random-text", desc: "Random text", expectValid: false },
  { qr: "12345", desc: "Just numbers", expectValid: false },
];

console.log("=" .repeat(60));
console.log("QR VALIDATION DIAGNOSTIC TEST");
console.log("=" .repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = parseStudentID_current(test.qr);
  const isCorrect = result.valid === test.expectValid;
  
  const status = isCorrect ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${index + 1}. ${test.desc}`);
  console.log(`   Input: "${test.qr}"`);
  console.log(`   Expected: ${test.expectValid ? "VALID" : "INVALID"}`);
  console.log(`   Got: ${result.valid ? "VALID" : "INVALID"}`);
  console.log(`   ${status}`);
  
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  
  if (isCorrect) {
    passed++;
  } else {
    failed++;
  }
});

console.log("\n" + "=".repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log("=".repeat(60));

if (failed > 0) {
  console.log("\n🔍 ANALYSIS:");
  console.log("The current validation uses regex pattern which DOES work for EDU- prefix.");
  console.log("However, the debug rules require EXPLICIT prefix check for better error messages.");
  console.log("\nRECOMMENDATION: Add explicit startsWith('EDU-') check before regex match.");
}
