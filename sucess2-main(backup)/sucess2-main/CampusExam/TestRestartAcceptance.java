import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.*;
import java.util.*;
import java.util.concurrent.TimeoutException;
import javax.crypto.*;
import javax.crypto.spec.*;

public class TestRestartAcceptance {
    private static final int TEST_PORT = 8089;
    private static final Path TEST_STORAGE = Path.of("lab_storage_test").toAbsolutePath();
    private static final Path TEST_KEYS = Path.of("lab_server_keys").toAbsolutePath();
    private static PrivateKey centralPrivateKey;
    private static PublicKey centralPublicKey;

    public static void main(String[] args) throws Exception {
        System.out.println("==========================================================================");
        System.out.println("  TASK 5: ISOLATED LAB SERVER RESTART & PERSISTENCE ACCEPTANCE SUITE (JAVA)");
        System.out.println("==========================================================================");

        // Load Central keys
        Path cPriv = Path.of("keys", "central_private.key");
        KeyFactory kf = KeyFactory.getInstance("RSA");
        centralPrivateKey = kf.generatePrivate(new PKCS8EncodedKeySpec(Files.readAllBytes(cPriv)));
        Path cPub = Path.of("keys", "central_public.key");
        centralPublicKey = kf.generatePublic(new X509EncodedKeySpec(Files.readAllBytes(cPub)));
        System.out.println("[Crypto] Loaded Central RSA keys for test verification.");

        // Clean test storage
        deleteDir(TEST_STORAGE);
        Files.createDirectories(TEST_STORAGE.resolve("packages"));
        Files.createDirectories(TEST_STORAGE.resolve("submissions"));
        Files.createDirectories(TEST_STORAGE.resolve("results"));
        Files.createDirectories(TEST_STORAGE.resolve("credentials"));

        // Step 1: Start isolated Lab Server process
        System.out.println("\n[STEP 1] Starting isolated Lab Server process on port " + TEST_PORT + "...");
        Process labProc = startIsolatedLabServer();
        waitForServer(TEST_PORT, 10);
        System.out.println("  -> Isolated Lab Server running on port " + TEST_PORT);

        try {
            long SYNTH_EXAM_ID = 88801L;
            String mornSecret = "MITM-MORN-TEST";
            byte[] mornSalt = new byte[32];
            new SecureRandom().nextBytes(mornSalt);
            String mornSaltHex = HexFormat.of().formatHex(mornSalt);
            String mornHash = HexFormat.of().formatHex(derivePbkdf2(mornSecret, mornSalt));

            // Step 2: Provision Morning Credential with Valid Central Digital Signature
            System.out.println("\n[STEP 2] Provisioning synthetic Morning credential for Exam " + SYNTH_EXAM_ID + "...");
            String mornPayload = SYNTH_EXAM_ID + ":MORNING:1:" + mornHash + ":" + mornSaltHex + ":600000";
            String mornSig = signData(mornPayload.getBytes(StandardCharsets.UTF_8), centralPrivateKey);

            Map<String, Object> provReq = new LinkedHashMap<>();
            provReq.put("examinationId", SYNTH_EXAM_ID);
            provReq.put("sittingName", "MORNING");
            provReq.put("verifierHash", mornHash);
            provReq.put("salt", mornSaltHex);
            provReq.put("iterations", 600000);
            provReq.put("revision", 1);
            provReq.put("signatureHex", mornSig);

            Map<String, Object> provResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential", provReq);
            System.out.println("  -> Provisioning response: success=" + provResp.get("success"));
            if (!Boolean.TRUE.equals(provResp.get("success"))) throw new AssertionError("Provisioning failed: " + provResp);
            String ackMsg = String.valueOf(provResp.get("ackMessage"));
            String ackSig = String.valueOf(provResp.get("signatureHex"));
            if (ackMsg == null || ackSig == null || ackMsg.isBlank() || ackSig.isBlank()) {
                throw new AssertionError("Missing cryptographic acknowledgment!");
            }
            System.out.println("  -> Signed ACK received: " + ackMsg);

            // Verify file exists on disk
            Path credFile = TEST_STORAGE.resolve("credentials").resolve("sitting_unlock_verifiers.json");
            if (!Files.exists(credFile)) throw new AssertionError("Credentials file not created on disk at: " + credFile);
            System.out.println("  -> Verified durable storage file created: " + credFile + " (" + Files.size(credFile) + " bytes)");

            // Verify unlock works in-memory before restart
            Map<String, Object> unlReq = Map.of(
                    "studentUsn", "4MH21CS888",
                    "enteredPassword", mornSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING"
            );
            Map<String, Object> unlResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", unlReq);
            if (!Boolean.TRUE.equals(unlResp.get("success"))) throw new AssertionError("Unlock before restart failed: " + unlResp);
            System.out.println("  -> Morning credential successfully unlocks session before restart.");

            // Step 3: Restart Isolated Lab Server
            System.out.println("\n[STEP 3] RESTARTING ISOLATED LAB SERVER PROCESS...");
            labProc.destroyForcibly();
            labProc.waitFor();
            Thread.sleep(1000);
            labProc = startIsolatedLabServer();
            waitForServer(TEST_PORT, 10);
            System.out.println("  -> Isolated Lab Server restarted successfully.");

            // Step 4: Verify Morning Credential Still Works After Restart (Loaded from disk)
            System.out.println("\n[STEP 4] Verifying Morning credential works AFTER restart (loaded from persistent disk)...");
            Map<String, Object> postRestartReq = Map.of(
                    "studentUsn", "4MH21CS889",
                    "enteredPassword", mornSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING"
            );
            Map<String, Object> postRestartResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", postRestartReq);
            if (!Boolean.TRUE.equals(postRestartResp.get("success"))) {
                throw new AssertionError("Morning credential failed to unlock after restart! " + postRestartResp);
            }
            System.out.println("  -> PASS: Morning credential survived restart and verified offline without Central Backend!");

            // Step 5: Provision Afternoon Credential
            System.out.println("\n[STEP 5] Provisioning synthetic Afternoon credential for Exam " + SYNTH_EXAM_ID + "...");
            String aftSecret = "MITM-AFTR-TEST";
            byte[] aftSalt = new byte[32];
            new SecureRandom().nextBytes(aftSalt);
            String aftSaltHex = HexFormat.of().formatHex(aftSalt);
            String aftHash = HexFormat.of().formatHex(derivePbkdf2(aftSecret, aftSalt));

            String aftPayload = SYNTH_EXAM_ID + ":AFTERNOON:1:" + aftHash + ":" + aftSaltHex + ":600000";
            String aftSig = signData(aftPayload.getBytes(StandardCharsets.UTF_8), centralPrivateKey);

            Map<String, Object> aftProvReq = new LinkedHashMap<>();
            aftProvReq.put("examinationId", SYNTH_EXAM_ID);
            aftProvReq.put("sittingName", "AFTERNOON");
            aftProvReq.put("verifierHash", aftHash);
            aftProvReq.put("salt", aftSaltHex);
            aftProvReq.put("iterations", 600000);
            aftProvReq.put("revision", 1);
            aftProvReq.put("signatureHex", aftSig);

            Map<String, Object> aftProvResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential", aftProvReq);
            if (!Boolean.TRUE.equals(aftProvResp.get("success"))) throw new AssertionError("Afternoon provisioning failed: " + aftProvResp);
            System.out.println("  -> Afternoon credential provisioned and durably saved.");

            // Step 6: Restart Lab Server to test dual sitting persistence and isolation
            System.out.println("\n[STEP 6] Restarting Lab Server again to test dual sitting isolation & persistence...");
            labProc.destroyForcibly();
            labProc.waitFor();
            Thread.sleep(1000);
            labProc = startIsolatedLabServer();
            waitForServer(TEST_PORT, 10);

            // Cross-sitting verification: Afternoon password for Morning student must FAIL
            Map<String, Object> crossReq = Map.of(
                    "studentUsn", "4MH21CS890",
                    "enteredPassword", aftSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING"
            );
            Map<String, Object> crossResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", crossReq);
            if (Boolean.TRUE.equals(crossResp.get("success"))) throw new AssertionError("Afternoon secret unlocked Morning sitting!");
            System.out.println("  -> PASS: Cross-sitting isolation verified after restart (Afternoon secret rejected on Morning session).");

            // Correct Morning secret on Morning session must SUCCEED
            Map<String, Object> mornOkReq = Map.of(
                    "studentUsn", "4MH21CS890",
                    "enteredPassword", mornSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING"
            );
            Map<String, Object> mornOkResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", mornOkReq);
            if (!Boolean.TRUE.equals(mornOkResp.get("success"))) throw new AssertionError("Morning secret failed: " + mornOkResp);
            System.out.println("  -> PASS: Morning credential confirmed working on Morning sitting.");

            // Correct Afternoon secret on Afternoon session must SUCCEED
            Map<String, Object> aftOkReq = Map.of(
                    "studentUsn", "4MH21CS891",
                    "enteredPassword", aftSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "AFTERNOON"
            );
            Map<String, Object> aftOkResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", aftOkReq);
            if (!Boolean.TRUE.equals(aftOkResp.get("success"))) throw new AssertionError("Afternoon secret failed: " + aftOkResp);
            System.out.println("  -> PASS: Afternoon credential confirmed working on Afternoon sitting.");

            // Step 7: Authenticated Revocation of Morning
            System.out.println("\n[STEP 7] Authenticated revocation of Morning credential...");
            String revPayload = SYNTH_EXAM_ID + ":MORNING:REVOKE";
            String revSig = signData(revPayload.getBytes(StandardCharsets.UTF_8), centralPrivateKey);

            Map<String, Object> revReq = Map.of(
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING",
                    "signatureHex", revSig
            );
            Map<String, Object> revResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential/revoke", revReq);
            if (!Boolean.TRUE.equals(revResp.get("success"))) throw new AssertionError("Revocation failed: " + revResp);
            System.out.println("  -> Morning credential revoked and persisted to disk.");

            // Step 8: Restart Lab Server to confirm Revocation survives restart
            System.out.println("\n[STEP 8] Restarting Lab Server to confirm Revocation survives restart...");
            labProc.destroyForcibly();
            labProc.waitFor();
            Thread.sleep(1000);
            labProc = startIsolatedLabServer();
            waitForServer(TEST_PORT, 10);

            // Confirm revoked Morning credential remains rejected
            Map<String, Object> revCheckReq = Map.of(
                    "studentUsn", "4MH21CS892",
                    "enteredPassword", mornSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "MORNING"
            );
            Map<String, Object> revCheckResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", revCheckReq);
            if (Boolean.TRUE.equals(revCheckResp.get("success"))) throw new AssertionError("Revoked credential was accepted after restart!");
            System.out.println("  -> PASS: Revoked Morning credential remained rejected after restart! (errorCode=" + revCheckResp.get("errorCode") + ")");

            // Confirm Afternoon credential still works
            Map<String, Object> aftCheckReq = Map.of(
                    "studentUsn", "4MH21CS893",
                    "enteredPassword", aftSecret,
                    "examinationId", SYNTH_EXAM_ID,
                    "sittingName", "AFTERNOON"
            );
            Map<String, Object> aftCheckResp = postJson("http://127.0.0.1:" + TEST_PORT + "/api/security/unlock", aftCheckReq);
            if (!Boolean.TRUE.equals(aftCheckResp.get("success"))) throw new AssertionError("Afternoon credential broke after Morning revocation!");
            System.out.println("  -> PASS: Afternoon credential remains active and unaffected.");

            // Step 9: Replay Protection: Attempt to provision obsolete revision 1
            System.out.println("\n[STEP 9] Testing Replay / Obsolete Revision Protection...");
            Map<String, Object> replayReq = new LinkedHashMap<>();
            replayReq.put("examinationId", SYNTH_EXAM_ID);
            replayReq.put("sittingName", "AFTERNOON");
            replayReq.put("verifierHash", aftHash);
            replayReq.put("salt", aftSaltHex);
            replayReq.put("iterations", 600000);
            replayReq.put("revision", 1); // Same revision already provisioned
            replayReq.put("signatureHex", aftSig);

            Map<String, Object> replayResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential", replayReq);
            if (Boolean.TRUE.equals(replayResp.get("success"))) throw new AssertionError("Replayed revision 1 was accepted!");
            System.out.println("  -> PASS: Replayed/obsolete revision rejected: " + replayResp.get("errorCode") + " - " + replayResp.get("error"));

            // Step 10: Security Protection: Unsigned and Tampered requests
            System.out.println("\n[STEP 10] Testing Unsigned and Tampered Provisioning Requests...");
            // Unsigned
            Map<String, Object> unsignedReq = new LinkedHashMap<>();
            unsignedReq.put("examinationId", SYNTH_EXAM_ID);
            unsignedReq.put("sittingName", "AFTERNOON");
            unsignedReq.put("verifierHash", "tampered_hash");
            unsignedReq.put("salt", "tampered_salt");
            unsignedReq.put("iterations", 600000);
            unsignedReq.put("revision", 2);

            Map<String, Object> unsignedResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential", unsignedReq);
            if (Boolean.TRUE.equals(unsignedResp.get("success"))) throw new AssertionError("Unsigned request was accepted!");
            System.out.println("  -> PASS: Unsigned request rejected: " + unsignedResp.get("errorCode"));

            // Forged / Tampered signature
            Map<String, Object> forgedReq = new LinkedHashMap<>(unsignedReq);
            forgedReq.put("signatureHex", "0123456789abcdef");
            Map<String, Object> forgedResp = postJson("http://127.0.0.1:" + TEST_PORT + "/lab-api/sittings/unlock-credential", forgedReq);
            if (Boolean.TRUE.equals(forgedResp.get("success"))) throw new AssertionError("Forged signature was accepted!");
            System.out.println("  -> PASS: Forged signature rejected: " + forgedResp.get("errorCode"));

            // Step 11: Audit persisted file for plaintext passwords
            System.out.println("\n[STEP 11] Auditing persisted credential file for plaintext passwords...");
            String persistedText = Files.readString(credFile, StandardCharsets.UTF_8);
            if (persistedText.contains("rawSecret") || persistedText.contains("MITM-MORN") || persistedText.contains("MITM-AFTR")) {
                throw new AssertionError("SECURITY VIOLATION: Plaintext password found in persistent storage!");
            }
            System.out.println("  -> PASS: Zero plaintext passwords exist on disk. Only salted verifier hashes and salts are stored.");

            System.out.println("\n==========================================================================");
            System.out.println("  ALL TASK 5 RESTART & PERSISTENCE ACCEPTANCE TESTS PASSED (100% SUCCESS) ");
            System.out.println("==========================================================================");

        } finally {
            labProc.destroyForcibly();
            labProc.waitFor();
            deleteDir(TEST_STORAGE);
            System.out.println("\nCleaned up isolated test instance and test storage.");
        }
    }

    private static Process startIsolatedLabServer() throws IOException {
        ProcessBuilder pb = new ProcessBuilder("java", "-cp", "build_dev", "LabServer");
        Map<String, String> env = pb.environment();
        env.put("PORT", String.valueOf(TEST_PORT));
        env.put("BIND", "127.0.0.1");
        env.put("LAB_ID", "LAB-TEST-ISOLATED");
        env.put("CENTRAL_URL", "http://127.0.0.1:8081");
        env.put("LAB_KEYS_DIR", TEST_KEYS.toString());
        env.put("LAB_STORAGE_DIR", TEST_STORAGE.resolve("packages").toString());
        pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        return pb.start();
    }

    private static void waitForServer(int port, int timeoutSec) throws Exception {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutSec * 1000) {
            try {
                URL u = URI.create("http://127.0.0.1:" + port + "/api/health").toURL();
                HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(800);
                conn.setReadTimeout(800);
                if (conn.getResponseCode() == 200) return;
            } catch (Exception ignored) {
                Thread.sleep(300);
            }
        }
        throw new TimeoutException("Server failed to respond on port " + port);
    }

    private static String signData(byte[] data, PrivateKey key) throws Exception {
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(key);
        s.update(data);
        return HexFormat.of().formatHex(s.sign());
    }

    private static byte[] derivePbkdf2(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 600000, 256);
        SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        return f.generateSecret(spec).getEncoded();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> postJson(String urlStr, Map<String, Object> data) {
        try {
            byte[] body = LabServer.Json.stringify(data).getBytes(StandardCharsets.UTF_8);
            URL u = URI.create(urlStr).toURL();
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }
            int code = conn.getResponseCode();
            InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
            if (is == null) return Map.of("success", false, "statusCode", code);
            String respStr = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            Object obj = LabServer.Json.parse(respStr);
            if (obj instanceof Map<?, ?> m) {
                Map<String, Object> res = new LinkedHashMap<>();
                m.forEach((k, v) -> res.put(String.valueOf(k), v));
                res.put("statusCode", code);
                return res;
            }
            return Map.of("success", false, "statusCode", code, "raw", respStr);
        } catch (Exception e) {
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    private static void deleteDir(Path dir) {
        if (!Files.exists(dir)) return;
        try {
            Files.walk(dir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                    });
        } catch (Exception ignored) {}
    }
}
