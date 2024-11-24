import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import bodyParser from 'body-parser';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { brotliCompress } from 'zlib';
import { translate } from 'translate.js';

// 解析参数
const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    describe: 'Service port number',
    coerce: check_port,
    default: Number(process.env.PORT) || 6119
  })
  .option('alt', {
    alias: 'a',
    describe: 'Allow request alternatives translation',
    type: 'boolean',
    default: Boolean(process.env.ALTERNATIVE) || true
  })
  .option('cors', {
    alias: 'c',
    describe: 'Origin that allow cross-domain access',
    coerce: check_cors,
    default: process.env.CORS_ORIGIN || false
  })
  .help().alias('help', 'h')
  .argv;

// 定义配置
const app = express(),
  PORT = argv.port,
  allowAlternative = argv.alt,
  CORS = {
    origin: argv.cors,
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false
  };

app.use(cors(CORS));
app.use(bodyParser.json());

app.post('/translate', async (req, res) => await post(req, res));
app.get('/', async (req, res) => await get(req, res));

async function post(req, res) {
  const startTime = Date.now();

  let { text, source_lang, target_lang, alt_count } = req.body,
  source_lang = source_lang.toUpperCase();
  target_lang = target_lang.toUpperCase();

  // 检查请求体
  if (!req.body || !text || !target_lang || (alt_count !== undefined && typeof alt_count !== 'number')) {
    const duration = Date.now() - startTime;
    console.log(`[WARN] ${new Date().toISOString()} | POST "translate" | 400 | Bad Request | ${duration}ms`);
    return res.status(400).json({
      "code": 400,
      "message": "Bad Request"
    });
  }

  // 是否允许备选翻译
  if (!allowAlternative && alt_count !== undefined) {
    const duration = Date.now() - startTime;
    console.log(`[LOG] ${new Date().toISOString()} | POST "translate" | 405 | Alternative Not Allowed | ${duration}ms`);
    return res.status(405).json({
      "code": 405,
      "message": "Alternative Translate Not Allowed"
    });
    // alt_count = 0;
  }

  try {
    const result = await translate(text, source_lang, target_lang, alt_count);
    const duration = Date.now() - startTime; // 计算处理时间
    if(result.data == "") {
      console.error(`[ERROR] ${new Date().toISOString()} | POST "translate" | 500 | ${error.message} | ${duration}ms`);
      res.status(500).json({
        code: 500,
        message: "Translation failed",
        error: error.message
      });
    }
    console.log(`[LOG] ${new Date().toISOString()} | POST "translate" | 200 | ${duration}ms`);

    const responseData = {
      code: 200,
      data: result.data, // 取第一个翻译结果
      id: Math.floor(Math.random() * 10000000000), // 生成一个随机 ID
      method: "Free",
      source_lang,
      target_lang,
      alternatives: result.alternatives
    };

    brotliCompress(responseData, (err, compressedData) => {
      if (err) {
        console.error('压缩错误: '+err);
        res.json(responseData);
      } else {
        res.json(compressedData);
      }
    });

  } catch (err) {
    console.error(err, err.stack);
  }
};

async function get(req, res) {
  res.json({
    code: 200,
    message: "Welcome to the DeepL Free API. Please POST to '/translate'. Visit 'https://github.com/guobao2333/DeepLX-Serverless' for more information."
  });
};

function check_cors(arg) {
  if (arg === undefined) return;
  if (typeof arg === 'string' || typeof arg === 'boolean') {
    return arg;
  }
  console.error("ParamTypeError: \x1b[33m'"+arg+"'\x1b[31m, origin should be Boolean or String.\n\x1b[0meg: \x1b[32m'*' or true or RegExp");
  process.exit(1);
}

function check_port(arg) {
  if (typeof arg === 'number' && !isNaN(arg) && Number.isInteger(arg) && arg >= 0 && arg <= 65535) {
    return arg;
  }
  console.warn('WARNING:\x1b[0m port should be >= 0 and < 65536.\nUsed default value instead: 6119\n');
  return 6119;
}

// 启动本地服务器
app.listen(PORT, () => {
  console.log(`Server is running and listening on http://localhost:${PORT}`);
});

export { post, get };
