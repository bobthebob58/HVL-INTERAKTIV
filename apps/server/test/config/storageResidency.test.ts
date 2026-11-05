/**
 * Tests for the production rule that file storage is in the EEA, and for the locations the start-up log names
 * (D-109's amendment of 2026-11-04).
 *
 * Spec: DATA-004
 */
import { describe, expect, it } from 'vitest';
import {
  bucketNameProblems,
  deploymentLocations,
  EEA_S3_REGIONS,
  isEeaStorageHost,
  S3_BUCKET_VARIABLES,
  SDK_ENDPOINT_VARIABLES,
  storageResidencyProblems,
} from '../../src/config/storageResidency.js';
import { envProblems, productionEnv, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');
const problemsAt = (env: Record<string, string>): string[] => envProblems(env, AUTUMN_2026);

describe('[DATA-004] production keeps file storage in the EEA', () => {
  it.each(EEA_S3_REGIONS)('[DATA-004] accepts AWS itself in the EEA region %s', (region) => {
    expect(problemsAt(productionEnv({ S3_REGION: region }))).toEqual([]);
  });

  it.each(['us-east-1', 'eu-west-2', 'eu-central-2', 'ap-northeast-1'])(
    '[DATA-004] refuses AWS itself in %s, naming the region and the list',
    (region) => {
      expect(problemsAt(productionEnv({ S3_REGION: region }))).toEqual([
        `S3_REGION: ${region} is not an AWS region on the EEA list (${EEA_S3_REGIONS.join(', ')}); files must stay ` +
          'in Norway or the EEA (DATA-004)',
      ]);
    },
  );

  it.each([
    'https://s3.hvl.no',
    'https://objects.s3.hvl.no:9000',
    'https://hvl.no',
    'https://s3.sikt.no',
    'https://s3.eu-north-1.amazonaws.com',
    'https://s3.dualstack.eu-west-1.amazonaws.com',
    'https://s3-eu-central-1.amazonaws.com',
  ])('[DATA-004] accepts the storage endpoint %s', (endpoint) => {
    // WHY: with an endpoint the region string is the store's own label (MinIO's default is us-east-1), not a place.
    expect(problemsAt(productionEnv({ S3_ENDPOINT: endpoint, S3_REGION: 'us-east-1' }))).toEqual([]);
  });

  it.each([
    ['s3.us-east-1.amazonaws.com', 'https://s3.us-east-1.amazonaws.com'],
    ['s3.eu-west-2.amazonaws.com', 'https://s3.eu-west-2.amazonaws.com'],
    ['s3.amazonaws.com', 'https://s3.amazonaws.com'],
    ['evilhvl.no', 'https://evilhvl.no'],
    ['s3.hvl.no.example.com', 'https://s3.hvl.no.example.com'],
    ['s3.eu-north-1.amazonaws.com.example.com', 'https://s3.eu-north-1.amazonaws.com.example.com'],
    ['10.0.0.5', 'https://10.0.0.5:9000'],
  ])('[DATA-004] refuses the storage host %s, naming the host only', (host, endpoint) => {
    // Act
    const problems = problemsAt(productionEnv({ S3_ENDPOINT: endpoint.replace('://', '://key:secret@') }));
    // Assert
    expect(problems).toEqual([
      `S3_ENDPOINT: the host ${host} is not on the EEA storage list (an AWS EEA region, or under hvl.no or ` +
        'sikt.no); adding one needs an amendment to D-109 (DATA-004)',
    ]);
    expect(problems.join('\n')).not.toContain('secret');
  });

  it('[DATA-004] checks nothing outside production, so development keeps the local S3 emulator', () => {
    expect(
      problemsAt({ ...VALID_ENV, S3_ENDPOINT: 'http://localhost:5000', S3_REGION: 'us-east-1' }),
    ).toEqual([]);
    expect(
      storageResidencyProblems({ S3_ENDPOINT: 'http://localhost:5000', S3_REGION: 'eu-north-1' }),
    ).toHaveLength(1);
  });

  it('[DATA-004] matches AWS hosts by their region and other hosts by whole domain labels', () => {
    expect(['s3.eu-south-2.amazonaws.com', 'x.sikt.no'].map(isEeaStorageHost)).toEqual([true, true]);
    expect(['s3.eu-evil-1.amazonaws.com', 'sikt.no.evil', 'xsikt.no'].map(isEeaStorageHost)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('[DATA-004] production refuses the AWS SDK’s own endpoint variables', () => {
  it.each(SDK_ENDPOINT_VARIABLES)(
    '[DATA-004] refuses %s, which would send files past the TLS and EEA checks, naming no value',
    (name) => {
      // Arrange: AWS itself in an EEA region, which alone passes; the SDK would still send to the variable's URL.
      const env = productionEnv({
        S3_REGION: 'eu-north-1',
        [name]: 'http://key:secret@storage.example.us:9000',
      });
      // Act
      const problems = problemsAt(env);
      // Assert
      expect(problems).toEqual([
        `${name}: the AWS SDK would send files there unchecked for TLS and the EEA list; remove it and set ` +
          'S3_ENDPOINT instead (DATA-004)',
      ]);
      expect(problems.join('\n')).not.toMatch(/secret|example\.us/);
    },
  );

  it('[DATA-004] ignores an empty variable, and development keeps whatever the developer set', () => {
    expect(problemsAt(productionEnv({ AWS_ENDPOINT_URL_S3: '' }))).toEqual([]);
    expect(problemsAt({ ...VALID_ENV, AWS_ENDPOINT_URL: 'http://localhost:5000' })).toEqual([]);
  });
});

describe('[DATA-004] production takes plain bucket names only, never an ARN', () => {
  it.each(
    S3_BUCKET_VARIABLES.flatMap((name) => [
      [name, 'arn:aws:s3:us-east-1:123456789012:accesspoint/hvli'],
      [name, 'arn:aws:s3-outposts:us-west-2:123456789012:outpost/op-01234567890123456/accesspoint/hvli'],
      [name, 'hvli/content'],
      [name, 'HVLI-Content'],
    ]),
  )(
    '[DATA-004] refuses %s=%s, which the AWS SDK would route past S3_REGION, naming no value',
    (name, bucket) => {
      // Arrange: AWS itself in an EEA region, which alone passes; an access point ARN sends files to its own region.
      const env = productionEnv({ S3_REGION: 'eu-north-1', [name]: bucket });
      // Act
      const problems = problemsAt(env);
      // Assert
      expect(problems).toEqual([
        `${name}: production needs a plain S3 bucket name (lower-case letters, digits, dots and hyphens); an ARN ` +
          'would send files to its own region, past the EEA list (DATA-004)',
      ]);
      expect(problems.join('\n')).not.toMatch(/123456789012|us-east-1|us-west-2|hvli\//);
    },
  );

  it('[DATA-004] accepts plain names, dotted names and access point aliases, and development keeps any name', () => {
    expect(
      bucketNameProblems({ S3_CONTENT_BUCKET: 'hvli-content', S3_TEMPORARY_BUCKET: 'hvl.no.tmp-2026' }),
    ).toEqual([]);
    expect(
      problemsAt(productionEnv({ S3_CONTENT_BUCKET: 'hvli-ap-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p-s3alias' })),
    ).toEqual([]);
    expect(problemsAt({ ...VALID_ENV, S3_CONTENT_BUCKET: 'arn:aws:s3:us-east-1:1:accesspoint/x' })).toEqual(
      [],
    );
  });
});

describe('[DATA-004] where the data lives, for the start-up log', () => {
  it('[DATA-004] names the database and Redis hosts, the S3 region and endpoint host, never a credential', () => {
    // Act
    const located = deploymentLocations({
      DATABASE_URL: 'postgresql://hvli_app:Pa55word@pg.hvl.no:5432/hvli?sslmode=verify-full',
      REDIS_URL: 'rediss://:Redis-Pa55@redis.hvl.no:6380/0',
      S3_ENDPOINT: 'https://s3.hvl.no/some/path?x=1',
      S3_REGION: 'eu-north-1',
    });
    const aws = deploymentLocations({
      DATABASE_URL: 'postgresql://u:p@localhost/db',
      REDIS_URL: 'rediss://localhost',
      S3_ENDPOINT: undefined,
      S3_REGION: 'eu-west-1',
    });
    // Assert
    expect(located).toEqual({
      databaseHost: 'pg.hvl.no',
      redisHost: 'redis.hvl.no',
      s3Region: 'eu-north-1',
      s3EndpointHost: 's3.hvl.no',
    });
    expect(JSON.stringify(located)).not.toMatch(/Pa55|hvli_app|path|x=1/);
    expect(aws.s3EndpointHost).toBe('AWS');
  });

  it('[DATA-004] names the host node-postgres connects to when the URL has a host parameter (the last one)', () => {
    // Arrange
    const base = { REDIS_URL: 'rediss://redis.hvl.no', S3_ENDPOINT: undefined, S3_REGION: 'eu-north-1' };
    const url =
      'postgresql://u:p@pg.hvl.no/db?sslmode=verify-full&host=first.example&host=PG.Elsewhere.example';
    // Act
    const located = deploymentLocations({ ...base, DATABASE_URL: url });
    const plain = deploymentLocations({ ...base, DATABASE_URL: 'postgresql://u:p@pg.hvl.no/db?host=' });
    // Assert
    expect([located.databaseHost, plain.databaseHost]).toEqual(['pg.elsewhere.example', 'pg.hvl.no']);
  });
});
