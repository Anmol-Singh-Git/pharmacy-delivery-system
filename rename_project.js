const fs = require('fs');
const path = require('path');

const dirsToScan = [__dirname, path.join(__dirname, 'public')];
const exts = ['.html', '.js', '.css'];

dirsToScan.forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (exts.includes(ext)) {
            const filePath = path.join(dir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            let orig = content;
            
            // Replace exact cases of MedDeliver
            content = content.replace(/MedDeliver/g, 'MedDeliver');
            
            // Fix lowercase occurrences where applicable, but ignore the MongoDB connection string to prevent data loss
            let temp = content.split('mongodb://127.0.0.1:27017/medideliver');
            for(let i=0; i<temp.length; i++) {
                temp[i] = temp[i].replace(/MedDeliver/g, 'MedDeliver');
            }
            content = temp.join('mongodb://127.0.0.1:27017/medideliver');

            if (content !== orig) {
                fs.writeFileSync(filePath, content);
                console.log(`Updated project name in: ${file}`);
            }
        }
    });
});
