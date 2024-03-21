// tests for the server

const request = require('supertest');
const expect = require('chai').expect;
const app = require('./index'); // Import your app

describe('Files API', () => {
    describe('GET /files', () => {
        it('should return all files for the current user', async () => {
            const res = await request(app)
                .get('/files')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200);

            // Add more assertions here
            expect(res.body).to.be.an('array');
        });
    });

    describe('POST /files', () => {
        it('should create a new file', async () => {
            const file = {
                name: 'test.txt',
                content: 'This is a test file'
            };

            const res = await request(app)
                .post('/files')
                .send({ file })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200);

            // Add more assertions here
            expect(res.body).to.have.property('message', 'File uploaded successfully');
        });
    });
});