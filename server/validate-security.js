#!/usr/bin/env node

// Validation script for security improvements
import fs from 'fs';
import path from 'path';

console.log('🔍 Validating security implementation...\n');

const indexPath = path.resolve('./index.js');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Check 1: Helmet import and usage
if (indexContent.includes('import helmet from "helmet"')) {
  console.log('✅ Helmet imported correctly');
} else {
  console.log('❌ Helmet import missing');
}

if (indexContent.includes('app.use(helmet(')) {
  console.log('✅ Helmet middleware configured');
} else {
  console.log('❌ Helmet middleware not configured');
}

// Check 2: Body size limits
if (indexContent.includes('limit: JSON_LIMIT')) {
  console.log('✅ JSON body size limit implemented');
} else {
  console.log('❌ JSON body size limit missing');
}

if (indexContent.includes('limit: URLENCODED_LIMIT')) {
  console.log('✅ URL-encoded body size limit implemented');
} else {
  console.log('❌ URL-encoded body size limit missing');
}

// Check 3: 404 handler
if (indexContent.includes("app.use('*'") && indexContent.includes('Route not found')) {
  console.log('✅ 404 handler implemented');
} else {
  console.log('❌ 404 handler missing or incorrect');
}

// Check 4: Safe error handling
if (indexContent.includes('NODE_ENV === \'development\'') && indexContent.includes('Something went wrong')) {
  console.log('✅ Safe error handling implemented');
} else {
  console.log('❌ Safe error handling missing or incorrect');
}

// Check 5: Middleware order
const middlewareOrder = [];
const lines = indexContent.split('\n');
let inMiddlewareSection = false;

for (const line of lines) {
  if (line.includes('app.use(helmet(')) {
    middlewareOrder.push('helmet');
  } else if (line.includes('app.use(express.json')) {
    middlewareOrder.push('body-parser');
  } else if (line.includes('app.use("/api')) {
    middlewareOrder.push('api-routes');
  } else if (line.includes("app.use('*'") && line.includes('404')) {
    middlewareOrder.push('404-handler');
  } else if (line.includes('app.use((err, req, res, next)')) {
    middlewareOrder.push('error-handler');
  }
}

console.log('\n📋 Middleware order detected:', middlewareOrder.join(' → '));

const expectedOrder = ['helmet', 'body-parser', 'api-routes', '404-handler', 'error-handler'];
const orderCorrect = JSON.stringify(middlewareOrder.slice(0, 5)) === JSON.stringify(expectedOrder);

if (orderCorrect) {
  console.log('✅ Middleware order is correct');
} else {
  console.log('❌ Middleware order needs attention');
  console.log('Expected:', expectedOrder.join(' → '));
}

console.log('\n📊 Validation Summary:');
console.log('- Security headers (Helmet): ' + (indexContent.includes('app.use(helmet(') ? '✅' : '❌'));
console.log('- Body size limits: ' + (indexContent.includes('limit: JSON_LIMIT') ? '✅' : '❌'));
console.log('- 404 handler: ' + (indexContent.includes('Route not found') ? '✅' : '❌'));
console.log('- Safe error handling: ' + (indexContent.includes('Something went wrong') ? '✅' : '❌'));
console.log('- Middleware order: ' + (orderCorrect ? '✅' : '❌'));

console.log('\n✅ Validation completed!');