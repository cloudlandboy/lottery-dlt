const fs = require('fs');
const dateFns = require('date-fns');
const readline = require('readline');
const util = require('util');
const assert = require('assert');
const axios = require('axios');
const { tr } = require('date-fns/locale');
const { off } = require('process');
const dataFilePath = __dirname + '/' + 'data.json';


//readline控制台
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


const drawRules = {
    "5+2": { grade: 1, label: "一等奖" },
    "5+1": { grade: 2, label: "二等奖" },
    "5+0": { grade: 3, label: "三等奖" },
    "4+2": { grade: 4, label: "四等奖" },
    "4+1": { grade: 5, label: "五等奖" },
    "3+2": { grade: 6, label: "六等奖" },
    "4+0": { grade: 7, label: "七等奖" },
    "3+1": { grade: 8, label: "八等奖" },
    "2+2": { grade: 8, label: "八等奖" },
    "3+0": { grade: 9, label: "九等奖" },
    "1+2": { grade: 9, label: "九等奖" },
    "2+1": { grade: 9, label: "九等奖" },
    "0+2": { grade: 9, label: "九等奖" }
};


(async function () {
    let lastDrawDate = getLastDrawDate();
    console.log("最后一次开奖日期：" + lastDrawDate);
    var data = {};
    //如果文件不存在，则创建文件
    if (fs.existsSync(dataFilePath)) {
        //读取文件赋值给data
        data = JSON.parse(fs.readFileSync(dataFilePath));
        if (!data.lastDrawDate || lastDrawDate != data.lastDrawDate) {
            data = await downloadData();
        }
    } else {
        data = await downloadData();
    }


    console.log("总计开奖次数：" + data.total);

    console.log("================================================ 重复号码 ================================================");
    for (let number of data.repeatDrawNumbers) {
        let statistic = data.drawNumberCount[number];
        console.log(number + " : " + statistic.total + "，依次期号：" + statistic.drawNums);
    }
    console.log("============================================== 前区重复号码 ==============================================");
    for (let number of data.repeatFrontDrawNumbers) {
        let statistic = data.frontDrawNumberCount[number];
        console.log(number + " : " + statistic.total + "，中奖号：" + statistic.fullNumber + "，依次期号：" + statistic.drawNums);
    }
    console.log("============================================== 后区重复号码 ==============================================");
    for (let number of data.repeatBackDrawNumbers) {
        let statistic = data.backDrawNumberCount[number];
        console.log(number + " : " + statistic.total);
    }

    var runCount = 0

    let yesOrNo = await waitForInput("是否随机生成(Y/N)：");
    let mode = 1;
    let runlimit = 1;
    let grade = 9;
    const randomNumber = ("Y" == yesOrNo.toUpperCase());
    const yearNumbers = {};

    if (randomNumber) {
        mode = await waitForInput("选择随机模式：\n1：随机n次\n2：历史x等奖次数大于n次\n3：统计n年号的一等奖\n> ");
        //mode必须是1或2
        assert(mode == 1 || mode == 2 || mode == 3, "随机模式错误");
        if (mode == "1") {
            runlimit = parseInt(await waitForInput("请输入随机次数："));
        } else if (mode == "2") {
            grade = parseInt(await waitForInput("请输入需要几等奖："));
            runlimit = parseInt(await waitForInput("请输入需要几次："));
        } else if (mode == "3") {
            grade = parseInt(await waitForInput("请输入年号，例:22："));
            runlimit = 0;
            for (const number in data.drawNumberCount) {
                for (const num of data.drawNumberCount[number].drawNums) {
                    if (num.substr(0, 2) == grade) {
                        runlimit++;
                        yearNumbers[parseInt(num.substr(2))] = number;
                    }
                }
            }
        }
    }


    const filter = new Set();

    while (true) {
        runCount++;
        try {
            let inputF = [];
            let inputB = [];
            if (randomNumber) {
                if (mode == 3) {
                    let numbers = yearNumbers[runCount].split(" ");
                    inputF = numbers.slice(0, 5);
                    inputB = numbers.slice(5);
                } else {
                    inputF = getRandomNumber(1, 35, 5);
                    inputB = getRandomNumber(1, 12, 2);
                }
            } else {
                inputF = await waitForInput("请输入前区号码(每个号码之间用空格隔开)：");
                inputF = formatNumer(inputF, 1, 35, 5);
                inputB = await waitForInput("请输入后区号码(每个号码之间用空格隔开)：");
                inputB = formatNumer(inputB, 1, 12, 2);
            }

            const historyDraw = {};
            for (let number in data.drawNumberCount) {
                let inputFrontDrawNumbers = [];
                let inputBackDrawNumbers = [];

                let drawNumberArray = number.split(" ");
                let frontDrawNumber = drawNumberArray.slice(0, 5);
                for (let num of frontDrawNumber) {
                    if (inputF.includes(num)) {
                        inputFrontDrawNumbers.push(num);
                    }
                }
                let backDrawNumber = drawNumberArray.slice(5);
                for (let num of backDrawNumber) {
                    if (inputB.includes(num)) {
                        inputBackDrawNumbers.push(num);
                    }
                }

                let matchRule = inputFrontDrawNumbers.length + "+" + inputBackDrawNumbers.length;

                if (drawRules[matchRule]) {
                    if (historyDraw[drawRules[matchRule].grade]) {
                        historyDraw[drawRules[matchRule].grade].total += data.drawNumberCount[number].total;
                        historyDraw[drawRules[matchRule].grade].history.push({
                            number,
                            drawNums: data.drawNumberCount[number].drawNums,
                            drawTimes: data.drawNumberCount[number].drawNums.drawTimes,
                            matchFrontNumbers: inputFrontDrawNumbers,
                            matchBackNumbers: inputBackDrawNumbers
                        });
                    } else {
                        historyDraw[drawRules[matchRule].grade] = {
                            label: drawRules[matchRule].label,
                            total: 1,
                            history: [{
                                number,
                                drawNums: data.drawNumberCount[number].drawNums,
                                drawTimes: data.drawNumberCount[number].drawNums.drawTimes,
                                matchFrontNumbers: inputFrontDrawNumbers,
                                matchBackNumbers: inputBackDrawNumbers
                            }]
                        }
                    }
                }
            }

            let numberCode = inputF.join(" ") + " + " + inputB.join(" ");
            if (filter.has(numberCode)) {
                continue
            } else {
                filter.add(numberCode);
            }

            console.log(`===================================== ${numberCode} ====================================`);
            //遍历对象
            for (let key in historyDraw) {
                console.log("历史 " + historyDraw[key].label + " 中奖次数：" + historyDraw[key].total);
            }

            // let fileName = inputF.concat(inputB).join('+')+".json";
            // fs.writeFileSync(__dirname + '/' + fileName, JSON.stringify(historyDraw, null, 4))
            console.log("=================================================================================================");

            if (randomNumber) {
                if (mode == "1" && runCount >= runlimit) {
                    runlimit = parseInt(await waitForInput("请输入随机次数："));
                    runCount = 0;
                } else if (mode == "2" && historyDraw[grade] && historyDraw[grade].total >= runlimit) {
                    console.log("总计：" + runCount + "次");
                    await waitForInput("按回车键继续...");
                } else if (mode == "3" && runCount >= runlimit) {
                    break;
                }
            }
        } catch (err) {
            //打印错误信息
            console.error(err.message);
        }
    }
}());


async function downloadData() {
    console.log("开始下载最新数据...");
    let data = {
        lastDrawDate: null,
        total: 0,
        drawNumberCount: {},
        frontDrawNumberCount: {},
        backDrawNumberCount: {},
        repeatedFrontHyphenCount: {},
        repeatDrawNumbers: [],
        repeatFrontDrawNumbers: [],
        repeatBackDrawNumbers: [],
        repeatedFrontNumbers: {}
    };
    const pageSize = 500;
    var pageNo = 1;
    var pages = 1

    while (pageNo <= pages) {
        let result = await axios.get(`https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=${pageSize}&pageNo=${pageNo}`);
        result = result.data.value;
        pages = result.pages;

        if (pageNo === 1) {
            data.total = result.total;
            data.lastDrawDate = result.list[0].lotteryDrawTime;
        }

        //遍历result的list属性，使用for of循环
        for (let item of result.list) {
            calcuDrawNumbersCount(item.lotteryDrawResult, item.lotteryDrawResult, item.lotteryDrawNum, item.lotteryDrawTime, data.drawNumberCount);
            //将item.lotteryDrawResult按空格分割成数组
            let drawNumberArray = item.lotteryDrawResult.split(" ");
            //获取drawNumberArray前5个元素，然后使用空格拼接成字符串，前区号码
            let frontDrawNumber = drawNumberArray.slice(0, 5).join(" ");
            calcuDrawNumbersCount(frontDrawNumber, item.lotteryDrawResult, item.lotteryDrawNum, item.lotteryDrawTime, data.frontDrawNumberCount);
            //获取drawNumberArray第6个到最后一个元素，然后使用空格拼接成字符串，后区号码
            let backDrawNumber = drawNumberArray.slice(5).join(" ");
            calcuDrawNumbersCount(backDrawNumber, item.lotteryDrawResult, item.lotteryDrawNum, item.lotteryDrawTime, data.backDrawNumberCount);
        }
        // console.log(result.list);
        pageNo++;
    }

    //过滤出drawNumberCount中出现次数大于1的号码
    data.repeatDrawNumbers = Object.keys(data.drawNumberCount).filter(key => data.drawNumberCount[key].total > 1);
    //过滤出frontDrawNumberCount中出现次数大于1的号码
    data.repeatFrontDrawNumbers = Object.keys(data.frontDrawNumberCount).filter(key => data.frontDrawNumberCount[key].total > 1);
    //过滤出backDrawNumberCount中出现次数大于1的号码
    data.repeatBackDrawNumbers = Object.keys(data.backDrawNumberCount).filter(key => data.backDrawNumberCount[key].total > 1);

    //按出现次数排序
    data.repeatDrawNumbers.sort((a, b) => data.drawNumberCount[b].total - data.drawNumberCount[a].total);
    data.repeatFrontDrawNumbers.sort((a, b) => data.frontDrawNumberCount[b].total - data.frontDrawNumberCount[a].total);
    data.repeatBackDrawNumbers.sort((a, b) => data.backDrawNumberCount[b].total - data.backDrawNumberCount[a].total);

    //将data格式化写入文件
    fs.writeFileSync(dataFilePath, JSON.stringify(data));
    return data;
};


/**
 * 重复号码计数函数
 * @param {string} drawNum
 * @param {string} drawNumber
 * @param {string} drawTime
 * @param {object} bucketObj
 */
function calcuDrawNumbersCount(drawNumber, fullNumber, drawNum, drawTime, bucketObj) {
    if (bucketObj[drawNumber]) {
        bucketObj[drawNumber].total++;
        bucketObj[drawNumber].drawNums.push(drawNum);
        bucketObj[drawNumber].drawTimes.push(drawTime);
        bucketObj[drawNumber].fullNumber.push(fullNumber);
    } else {
        bucketObj[drawNumber] = {
            total: 1,
            fullNumber: [fullNumber],
            drawNums: [drawNum],
            drawTimes: [drawTime]
        };
    }
}


function getLastDrawDate() {
    //每周开奖日期
    const openDrawDays = [1, 3, 6];
    //最近一次开奖日期
    let now = new Date();
    let currentDay = now.getDay();

    if (currentDay == 0) {
        currentDay = 7;
    }

    let lastDrawDay = currentDay;

    //判断当前时间是否小于21:00:00
    if (now.getHours() < 21) {
        // 获取openDrawDays中最后一个小于currentDay的数字
        lastDrawDay = openDrawDays.filter(day => day < currentDay).pop();
    } else {
        lastDrawDay = openDrawDays.filter(day => day <= currentDay).pop();
    }

    if (!lastDrawDay) {
        return dateFns.format(dateFns.subDays(now, 2), "yyyy-MM-dd");
    }

    if (currentDay == lastDrawDay) {
        return dateFns.format(now, "yyyy-MM-dd");
    }

    now = dateFns.subDays(now, currentDay - lastDrawDay)
    return dateFns.format(now, "yyyy-MM-dd");
}


/**
 * 等待用户输入
 * @param {string} question 
 * @returns 
 */
function waitForInput(question) {
    return new Promise((resolve, reject) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}



function formatNumer(str, min, max, minLength) {
    let number = str.trim().split(" ");
    let result = [];
    //遍历frontNums，使用for i
    for (let i = 0; i < number.length; i++) {
        number[i] = parseInt(number[i]);
        assert(!isNaN(number[i]), "号码必须是数字");
        assert(number[i] >= min && number[i] <= max, `号码必须在${min}-${max}之间`);
        //如果result中不包含number[i]，则添加
        if (!result.includes(number[i])) {
            result.push(number[i]);
        }
    }
    //result的长度必须大于等于minLength
    assert(result.length >= minLength, `号码必须至少有${minLength}个`);
    return result.sort((a, b) => a - b).map(n => n < 10 ? `0${n}` : n + "");

}

//得到一个两数之间的随机整数
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomNumber(min, max, len) {
    let number = [];
    while (true) {
        let n = getRandomInt(min, max);
        if (number.indexOf(n) == -1) {
            number.push(n < 10 ? `0${n}` : n);
        }
        if (number.length == len) {
            break;
        }
    }
    number.sort((a, b) => a - b);

    return number;
}