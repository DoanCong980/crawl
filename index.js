const express = require("express");
const app = express();
const request = require("request");
const cheerio = require("cheerio");
const axios = require("axios");
const FormData = require("form-data");
const fetch = require("node-fetch");
const { response } = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const https = require("https");
const download = require("download-pdf");
const downloadPdf = require("download-pdf");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

app.get("/aus", (req, res) => {
  request(
    "https://www.pbs.gov.au/browse/brand-premium",
    (err, response, body) => {
      if (err) res.send("loi", err);
      else {
        let $ = cheerio.load(body);
        let result = [];
        let colList = [];
        $("#medicine-item tbody tr").each((iRow, eRow) => {
          let col = $(eRow).find("td");
          col.each((indexCol, eCol) => {
            colList.push($(eCol).text());
          });
          result.push(colList);
          colList = [];
        });
        result.shift();
        res.send(result);
      }
    }
  );
});

app.get("/vne", (req, res) => {
  request("https://vnexpress.net/", (err, response, body) => {
    if (err) res.send("loi: ", err);
    else {
      let $ = cheerio.load(body);
      let result = [];
      $(".main-nav li").each((i, e) => {
        const item = $(e).text();
        console.log(item);
        result.push(item);
      });
      res.send(JSON.stringify(result));
    }
  });
});

app.get("/malay", (req, res) => {
  request(
    "https://www.pharmacy.gov.my/v2/en/apps/drug-price",
    (err, response, body) => {
      if (err) res.send("loi: ", err);
      else {
        let $ = cheerio.load(body);
        let result = [];
        let colList = [];
        $(".tinytable tbody tr").each((indexRows, elRows) => {
          let cols = $(elRows).find("td");
          $(cols).each((indexCols, elCols) => {
            colList.push($(elCols).text());
          });
          result.push(colList);
          colList = [];
        });
        res.send(JSON.stringify(result));
      }
    }
  );
});
// --------------------philiptin--------------------------------------- //

app.get("/phil", async (req, res) => {
  const date = new Date();
  const year = date.getFullYear() - 1;
  const url =
    "https://dpri.doh.gov.ph/index.php?page=drugletter&drugname=&dpryear=" +
    year;
  const response = await fetch(url, {
    method: "GET",
    agent: httpsAgent,
  });
  const html = await response.text();
  const listUrls = await getAllUrlOfDrugs(html);
  let count = 0;
  const dataFromPageOfDrug = [];
  for (let url of listUrls) {
    let data = await goToLinkDrugs("https://dpri.doh.gov.ph/" + url);
    dataFromPageOfDrug.push(data);
    console.log(data);
  }
  res.send("JSON.stringify(dataFromPageOfDrug)");
});

const getAllUrlOfDrugs = async (html) => {
  let $ = cheerio.load(html);
  let listUrls = [];
  $("table a").each((index, dom) => {
    const url = $(dom).attr("href");
    listUrls.push(url);
  });
  return listUrls;
};

const goToLinkDrugs = async (url) => {
  const response = await fetch(url, {
    method: "GET",
    agent: httpsAgent,
  });
  const html = await response.text();
  let $ = cheerio.load(html);
  let NameAndPriceOfDrug = [];
  let listFacilityName = [];
  $(".col-md-12 h4").each((index, dom) => {
    let nameOfDrug = $(dom).text();
    nameOfDrug = nameOfDrug.substring(nameOfDrug.search(":") + 1);
    NameAndPriceOfDrug.push(nameOfDrug);
  });

  $("#xtable tr").each((rowIndex, rowDom) => {
    let rowLists = [];
    let colListItems = $(rowDom).find("td");
    colListItems.each((colIndex, colDom) => {
      rowLists.push($(colDom).text());
    });
    listFacilityName.push(rowLists);
  });
  return {
    NameAndPriceOfDrug,
    listFacilityName,
  };
};
// ---------------singapore--------------------------------------- //

app.get("/sing", async (req, res) => {
  const URL =
    "https://www.pss.org.sg/know-your-medicines/medicines-price-lists/drug-prices-common-chronic-diseases";
  let response = await fetch(URL, {
    method: "GET",
  });
  const HTML = await response.text();
  let downloadLinks = await getAllPdfLinks(HTML);
  downloadPdfFile(downloadLinks);
  res.send("aaaaaaaaaaaaaaa");
});

let downloadPdfFile = async (downloadLinks) => {
  let fileLocation = "./download";
  for (let link in downloadLinks) {
    let options = {
      directory: fileLocation,
    };
    await download(link, options, (er) => {
      if (err) throw err;
      console.log(link);
    });
  }
};

let getAllPdfLinks = async (HTML) => {
  let downloadLinks = [];
  let $ = cheerio.load(HTML);
  $(".field-item.even ul li a").each((index, dom) => {
    let link = "https://www.pss.org.sg";
    link += $(dom).attr("href");
    //console.log(link);
    downloadLinks.push(link);
  });
  return downloadLinks;
};
// --------------------korea--------------------------------------- //

const body = new FormData();
body.append("pageNo", "4");
body.append("searchYear", "2016");
body.append("searchArea", "40100000");

app.get("/kor", async (req, res) => {
  const response = await fetch(
    "https://www.price.go.kr/tprice/portal/servicepriceinfo/generaldrugprice/generalDrugPriceList.do",
    {
      method: "POST",
      body: body,
    }
  );
  const html = response.text();
  const result = await getDrugPriceKorea(html);
  const dataOfExcel = await handleFileExcel();
  res.send(JSON.stringify(result));
});

async function handleFileExcel() {
  if (typeof require !== "undefined") {
    let workBooks = XLSX.readFile("korea.xls");
    let workSheets = "";
    for (const sheetNames of workBooks.SheetNames) {
      workSheets = XLSX.utils.sheet_to_json(workBooks.Sheets[sheetNames]);
    }
    console.log("successed");
    let records = [];
    workSheets.map((row) => {
      let record = _transformData(row);
      records.push(record);
    });
    res.send(records);
  } else {
    console.log(err);
  }
}

async function getDrugPriceKorea(html) {
  let result = [];
  let $ = await cheerio.load(html);
  $(".table_t1 tbody tr").each((indexRows, elRows) => {
    let colList = [];
    let cols = $(elRows).find("td");
    $(cols).each((indexCols, elCols) => {
      colList.push($(elCols).text());
    });
    result.push(colList);
  });
  return result;
}

function _transformData(row) {
  let columns = {
    stt: "번호",
    year: "등록년도",
    col3: "지역",
    col4: "시/군/구",
    col5: "약품종류",
  };

  let record = {};
  for (let key in row) {
    let prop;
    for (let keyCol in columns) {
      if (columns[keyCol] == key) prop = keyCol;
    }
    record[prop] = row[key];
  }
  return record;
}

app.listen(8080);