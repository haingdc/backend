import "@std/dotenv/load";
import { Hono } from "npm:hono";
import type { Context } from "npm:hono";
import sharp from "npm:sharp";
import { OpenAI } from "@openai/openai";

const app = new Hono();

// Xử lý upload hình ảnh
app.post("/upload", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("image");

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    // Lấy tên file gốc và encode để tránh vấn đề với dấu cách
    const originalFileName = image.name || "unknown";
    const encodedFileName = encodeURIComponent(originalFileName);

    return c.json({
      message: "Đã nhận được bức hình",
      fileName: originalFileName,
      encodedFileName: encodedFileName,
    }, 200);
  } catch (error) {
    console.error("Lỗi khi xử lý upload:", error);
    return c.json({ message: "Có lỗi xảy ra khi xử lý upload" }, 500);
  }
});

// API trả về base64 string
app.post("/upload-base64", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("image");

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    const arrayBuffer = await image.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    // Mã hóa thành Base64
    const base64String = btoa(binary);

    return c.json({
      message: "Đã nhận được bức hình",
      fileName: image.name || "unknown",
      base64: `data:${image.type};base64,${base64String}`,
    }, 200);
  } catch (error) {
    console.error("Lỗi khi xử lý upload:", error);
    return c.json({ message: "Có lỗi xảy ra khi xử lý upload" }, 500);
  }
});

// API chuyển đổi hình ảnh sang WebP
app.post("/convert-to-webp", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("image");

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    // Đọc file thành Uint8Array
    const arrayBuffer = await image.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Chuyển đổi sang WebP với sharp
    const webpBuffer = await sharp(uint8Array)
      .webp({ quality: 80 }) // quality từ 1-100
      .toBuffer();

    // Chuyển đổi buffer sang Base64 mà không gây stack overflow
    const binaryWebp = new Uint8Array(webpBuffer);
    let binaryString = "";
    for (let i = 0; i < binaryWebp.length; i++) {
      binaryString += String.fromCharCode(binaryWebp[i]);
    }

    const base64String = btoa(binaryString);

    return c.json({
      message: "Đã chuyển đổi hình ảnh sang WebP",
      fileName: `${image.name.split(".")[0]}.webp`,
      base64: `data:image/webp;base64,${base64String}`,
    }, 200);
  } catch (error) {
    console.error("Lỗi khi chuyển đổi hình ảnh:", error);
    return c.json({ message: "Có lỗi xảy ra khi chuyển đổi hình ảnh" }, 500);
  }
});

// API trả về file WebP
app.post("/convert-to-webp-file", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("image");

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    // Đọc file thành Uint8Array
    const arrayBuffer = await image.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Chuyển đổi sang WebP với sharp
    const webpBuffer = await sharp(uint8Array)
      .webp({ quality: 50 })
      .toBuffer();

    // Tạo tên file mới
    const newFileName = `${image.name.split(".")[0]}.webp`;

    // Trả về file WebP
    c.header("Content-Type", "image/webp");
    c.header("Content-Disposition", `attachment; filename="${newFileName}"`);
    return c.body(webpBuffer);
  } catch (error) {
    console.error("Lỗi khi chuyển đổi hình ảnh:", error);
    return c.json({ message: "Có lỗi xảy ra khi chuyển đổi hình ảnh" }, 500);
  }
});

app.post("/describe", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("image");
    const type = body.get("type");

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    const arrayBuffer = await image.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    // Mã hóa thành Base64
    const base64Image = btoa(binary);

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY")!,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Bạn là một trợ lý hữu ích và hãy trả lời bằng tiếng Việt.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: type === 'alt' ? "Bạn hãy cho 1 mô ta ngắn gọn để làm alt cho bức hình, tối thiểu 4 từ và tối đa 12 từ, trong phạm vi một câu." : "Có gì trong bức ảnh này?" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    return c.json({
      status: "success",
      data: response.choices[0].message.content,
    }, 200);
  } catch (error) {
    console.error("Lỗi khi xử lý upload:", error);
    return c.json({ message: "Có lỗi xảy ra khi xử lý upload" }, 500);
  }
});

// API mô tả hình ảnh
app.post("/describe-deprecated", async (c: Context) => {
  try {
    const body = await c.req.formData();
    const image = body.get("file");
    const type = body.get("type") as string;

    if (!image || !(image instanceof File)) {
      return c.json({ message: "Không tìm thấy hình ảnh trong request" }, 400);
    }

    // Giả lập mô tả ảnh dựa vào type
    let description = "";
    if (type === "alt") {
      description =
        "Đây là mô tả chi tiết về hình ảnh, bao gồm các yếu tố như màu sắc, bố cục, và các đối tượng chính trong ảnh.";
    } else if (type === "short") {
      description = "Mô tả ngắn gọn về nội dung chính của hình ảnh.";
    } else {
      description = "Mô tả mặc định cho hình ảnh.";
    }

    return c.json({
      message: "Đã phân tích hình ảnh",
      fileName: image.name || "unknown",
      description: description,
    }, 200);
  } catch (error) {
    console.error("Lỗi khi phân tích hình ảnh:", error);
    return c.json({ message: "Có lỗi xảy ra khi phân tích hình ảnh" }, 500);
  }
});

const port = 8000;
console.log(`Server đang chạy tại http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
