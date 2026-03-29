import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/db';
import busboy from 'busboy';
import fs from 'fs'; // ✅ Regular fs for streams
import fsPromises from 'fs/promises'; // ✅ Promises version for async ops
import path from 'path';
import { Readable } from 'stream';

// Next.js config - static literal object
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper: Read stream as buffer
function readStream(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// POST API with busboy
export async function POST(req: NextRequest) {
  let client;
  const uploadedFiles: string[] = []; // Track files for cleanup

  try {
    // Convert NextRequest body to Node.js Readable stream
    // @ts-ignore - accessing internal Node.js stream from NextRequest
    const nodeStream = req.body as unknown as Readable;
    
    const bb = busboy({
      headers: req.headers as any,
      limits: {
        files: 7,
        fileSize: 5 * 1024 * 1024, // 5MB per file
      },
    });

    const fields: Record<string, string> = {};

    // Parse form data
    const parsePromise = new Promise<void>((resolve, reject) => {
      bb.on('field', (name, value) => {
        fields[name] = value;
      });

      bb.on('file', async (name, file, info) => {
        const { filename } = info;
        if (!filename) return;

        try {
          // Generate unique filename
          const ext = path.extname(filename);
          const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
          const uploadPath = path.join(process.cwd(), 'public/uploads', uniqueName);

          // ✅ Use regular fs.createWriteStream (not fs/promises)
          const writeStream = fs.createWriteStream(uploadPath);
          
          file.pipe(writeStream);

          await new Promise<void>((res, rej) => {
            writeStream.on('finish', res);
            writeStream.on('error', rej);
          });

          uploadedFiles.push(`/uploads/${uniqueName}`);
        } catch (err) {
          reject(err);
        }
      });

      bb.on('finish', resolve);
      bb.on('error', reject);
    });

    // Pipe the request body to busboy
    if (nodeStream) {
      nodeStream.pipe(bb);
    } else {
      const buffer = await readStream(req.body as any);
      bb.end(buffer);
    }

    await parsePromise;

    // Validation
    const { title, originalPrice, discountPrice, description, specifications } = fields;

    if (!title || !originalPrice || !description) {
      return NextResponse.json({ error: 'Title, Price and Description are required' }, { status: 400 });
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }

    if (uploadedFiles.length > 7) {
      return NextResponse.json({ error: 'Maximum 7 images allowed' }, { status: 400 });
    }

    // Database insert
    client = await pool.connect();
    
    const query = `
      INSERT INTO products (title, original_price, discount_price, description, images, specifications)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      title,
      parseFloat(originalPrice),
      discountPrice ? parseFloat(discountPrice) : null,
      description,
      JSON.stringify(uploadedFiles),
      specifications ? JSON.parse(specifications) : null
    ];

    const result = await client.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error: any) {
    console.error('Upload Error:', error);
    
    // Cleanup: Delete uploaded files if DB insert fails
    for (const filePath of uploadedFiles) {
      try {
        await fsPromises.unlink(path.join(process.cwd(), 'public', filePath));
      } catch (e) {
        console.warn(`Could not delete file: ${filePath}`);
      }
    }
    
    return NextResponse.json({ error: error.message || 'Failed to upload product' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// GET API
export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
    client.release();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// DELETE API
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    // Get images for cleanup
    const productResult = await client.query('SELECT images FROM products WHERE id = $1', [id]);
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    client.release();

    // Cleanup uploaded files from disk
    if (productResult.rows[0]?.images) {
      const images: string[] = productResult.rows[0].images;
      for (const imgUrl of images) {
        const fileName = imgUrl.split('/').pop();
        if (fileName) {
          const filePath = path.join(process.cwd(), 'public/uploads', fileName);
          try {
            await fsPromises.unlink(filePath);
          } catch (e) {
            console.warn(`Could not delete file: ${filePath}`);
          }
        }
      }
    }

    return NextResponse.json({ message: 'Product deleted' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}