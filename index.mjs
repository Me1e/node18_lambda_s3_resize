// AWS S3와 sharp 라이브러리를 임포트합니다.
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

// AWS S3 클라이언트를 초기화합니다.
const s3 = new S3Client({ region: 'ap-northeast-2' });

// 읽을 수 있는 스트림을 버퍼로 변환하는 함수입니다.
const streamToBuffer = async (readableStream) => {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

// 이미지의 형식을 확인하는 함수입니다.
const getImageType = async (key) => {
  const typeMatch = key.match(/\.([^.]*)$/);
  if (!typeMatch) {
    console.log('Could not determine the image type.');
    return null;
  }
  const imageType = typeMatch[1].toLowerCase();
  return ['jpg', 'png'].includes(imageType) ? imageType : null;
};

// 이미지를 가져오는 함수입니다.
const fetchImage = async (bucket, key) => {
  try {
    const params = { Bucket: bucket, Key: key };
    const response = await s3.send(new GetObjectCommand(params));
    return await streamToBuffer(response.Body);
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

// 이미지 크기를 조절하는 함수입니다.
const resizeImage = async (buffer, width) => {
  try {
    return await sharp(buffer).resize(width, width).toBuffer();
  } catch (error) {
    console.error('Error resizing image:', error);
    return null;
  }
};

// 이미지를 업로드하는 함수입니다.
const uploadImage = async (bucket, key, buffer, contentType) => {
  try {
    const params = {
      Bucket: bucket,
      Key: 'resized/' + key,
      Body: buffer,
      ContentType: contentType,
    };
    await s3.send(new PutObjectCommand(params));
  } catch (error) {
    console.error('Error uploading image:', error);
  }
};

// Lambda 핸들러 함수입니다.
export const handler = async (event) => {
  // 이벤트로부터 버킷 이름과 키를 추출합니다.
  const srcBucket = event.Records[0].s3.bucket.name;
  const srcKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, ' ')
  );

  // 이미지 형식을 확인합니다.
  const imageType = await getImageType(srcKey);
  if (!imageType) return;

  // 원본 이미지를 가져옵니다.
  const origImage = await fetchImage(srcBucket, srcKey);
  if (!origImage) return;

  // 이미지의 새로운 너비를 설정합니다.
  const width = parseInt('200');

  // 이미지의 크기를 조절합니다.
  const resizedImage = await resizeImage(origImage, width);
  if (!resizedImage) return;

  // 이미지를 업로드합니다.
  await uploadImage(srcBucket, srcKey, resizedImage, `image/${imageType}`);

  // 작업이 완료되었음을 로그로 출력합니다.
  console.log(
    `${srcBucket}/${srcKey} 이미지를 리사이징 하여 ${srcBucket}/resized/${srcKey}에 업로드 하였습니다`
  );
};
