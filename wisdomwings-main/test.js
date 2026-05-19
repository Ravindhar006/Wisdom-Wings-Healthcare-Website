const fs = require('fs');

async function testFetch() {
    const res = await fetch('https://res.cloudinary.com/dtdt3aw3s/raw/upload/courses.json?t=' + Date.now());
    const text = await res.text();
    console.log("Raw JSON in Cloudinary:", text);
}

testFetch();
