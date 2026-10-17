import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { Readable } from 'stream';
import { FilesController } from '../../src/files/files.controller';
import { LocalStorageService } from '../../src/files/storage.service';
import type { AppConfig } from '../../src/config/configuration';

describe('Signed file embedding with Helmet', () => {
  function setup(validSignature = true) {
    const storage = Object.create(LocalStorageService.prototype) as LocalStorageService;
    storage.validateSignedUrl = jest.fn().mockReturnValue(validSignature);
    storage.stream = jest.fn().mockImplementation(() => Readable.from(Buffer.from('fixture')));
    const controller = new FilesController(storage, { storage: { provider: 'local' } } as AppConfig);
    const app = express();
    app.use(helmet());
    app.get('/signed', (req, res) => {
      void controller.signedDownload(String(req.query.key), '9999999999', 'signature', res)
        .catch(() => res.sendStatus(403));
    });
    return { app, storage };
  }

  it.each(['photo.jpg', 'photo.png', 'photo.webp'])('allows signed %s to render on the frontend origin', async key => {
    const { app } = setup();
    await request(app).get('/signed').query({ key: Buffer.from(key).toString('base64url') })
      .expect(200).expect('Cross-Origin-Resource-Policy', 'cross-origin')
      .expect('Cache-Control', 'private, no-store');
  });

  it('keeps the default resource protection for documents', async () => {
    const { app } = setup();
    await request(app).get('/signed').query({ key: Buffer.from('resume.pdf').toString('base64url') })
      .expect(200).expect('Cross-Origin-Resource-Policy', 'same-origin');
  });

  it('rejects invalid signatures before allowing image embedding', async () => {
    const { app, storage } = setup(false);
    await request(app).get('/signed').query({ key: Buffer.from('photo.jpg').toString('base64url') })
      .expect(403).expect('Cross-Origin-Resource-Policy', 'same-origin');
    expect(storage.stream).not.toHaveBeenCalled();
  });
});
