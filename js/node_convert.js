const fs = require("fs");
const he = require("he");

const isWindows = process.platform === "win32";
const input  = isWindows ? "./data/spiewnik.txt" : "./data/spiewnik.txt";
const output = isWindows ? "./data/songs.json"   : "./data/songs.json";

const SEP = "= = = =";

function isSeparator(line) {
  return line.includes(SEP);
}

function decode(s) {
  return he.decode(s || "");
}

const lines = fs.readFileSync(input, "utf8").split("\n");

let songs = [];
let i = 0;
let id = 1;

while (i < lines.length) {
  // search first separator
  if (!isSeparator(lines[i])) {
    i++;
    continue;
  }

  // ðŸ”¹ TITLE
  let titleLine = lines[i + 1] || "";
  let title = "";
  let author = "";

  if (titleLine.startsWith("END::")) break;

  if (titleLine.startsWith("TITLE:")) {
    let val = titleLine.replace("TITLE:", "").trim();

    if (val.includes(" - ")) {
      const [t, a] = val.split(" - ");
      title = t.trim();
      author = (a || "").trim();
    } else {
      title = val;
    }
  }

  
  i += 2;
  while (i < lines.length && !isSeparator(lines[i])) i++;
  i++; 

  // ðŸ”¹ zbieraj content aÅ¼ do kolejnego separatora
  let contentLines = [];
  let url = "";

  while (i < lines.length && !isSeparator(lines[i])) {
    let line = decode(lines[i]).trimEnd();

    if (line.startsWith("URL::")) {
      url = line.replace("URL::", "").trim();
    } else {
      contentLines.push(line);
    }

    i++;
  }

  // ðŸ”¹ usuÅ„ puste linie z poczÄ…tku/koÅ„ca
  while (contentLines.length && contentLines[0].trim() === "") contentLines.shift();
  while (contentLines.length && contentLines[contentLines.length - 1].trim() === "") contentLines.pop();

  songs.push({
    id: `seed-${id++}`,
    title,
    author,
    category: "piosenka",
    content: contentLines.join("\n"),
    ...(url ? { url } : {})
  });
}

fs.writeFileSync(output, JSON.stringify(songs, null, 2), "utf8");

console.log("Converted songsOK:", songs.length);