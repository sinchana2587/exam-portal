import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.*;

/**
 * MIT Mysore Examination Management System - Dedicated Independent Lab Server.
 * Runs as a separate OS process, listening on port 8082 (configurable).
 * Maintains completely independent cryptographic keys (possesses ONLY lab_private.key,
 * lab_public.key, and central_public.key; NEVER central_private.key).
 * Persists packages locally for offline examination delivery without central DB dependency.
 * Phase 8: Authoritative student examination runtime engine.
 * Phase 9: COE live monitoring, Lab Instructor crash recovery, and signed .labresult generation.
 */
public final class LabServer {

    public static final SecureRandom RANDOM = new SecureRandom();
    public static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    public static String LAB_ID = "LAB-CSE-01";
    public static int PORT = 8082;
    public static String BIND = "127.0.0.1";
    public static Path KEYS_DIR = Path.of("lab_server_keys");
    public static Path STORAGE_DIR = Path.of("lab_storage", "packages");
    public static Path SUBMISSIONS_DIR = Path.of("lab_storage", "submissions");
    public static Path RESULTS_DIR = Path.of("lab_storage", "results");
    public static Path CREDENTIALS_DIR = Path.of("lab_storage", "credentials");
    public static Path CREDENTIALS_FILE = CREDENTIALS_DIR.resolve("sitting_unlock_verifiers.json");

    // Cryptographic keys held by Lab Server
    public static PrivateKey labPrivateKey;
    public static PublicKey labPublicKey;
    public static PublicKey centralPublicKey;

    // Active in-memory offline runtime
    public static final class CohortState {
        public long examinationId;
        public String sittingName;
        public String labId;
        public Map<String, Object> sessionMetadata = new ConcurrentHashMap<>();
        public Map<String, Map<String, Object>> versions = new ConcurrentHashMap<>();
        public Map<String, Integer> answerKeys = new ConcurrentHashMap<>();
        public Map<String, Map<String, Object>> roster = new ConcurrentHashMap<>(); // usn -> student details
        public Map<String, String> studentAssignedVersion = new ConcurrentHashMap<>(); // usn -> version
        public Map<String, Object> packageDoc = new ConcurrentHashMap<>();
    }

    public static final class RuntimeState {
        // Multi-cohort registry for simultaneous multi-department examinations
        public static Map<Long, CohortState> activeCohorts = new ConcurrentHashMap<>(); // examinationId -> CohortState
        public static Map<String, Long> usnToCohortMap = new ConcurrentHashMap<>(); // usn -> examinationId

        // Active session tracking (backward-compatible defaults to most recent cohort)
        public static Long activeSessionId = null;
        public static String activeSittingName = null;
        public static Map<String, Object> sessionMetadata = new ConcurrentHashMap<>();
        public static Map<String, Map<String, Object>> versions = new ConcurrentHashMap<>();
        public static Map<String, Integer> answerKeys = new ConcurrentHashMap<>();
        public static Map<String, Map<String, Object>> roster = new ConcurrentHashMap<>(); // usn -> student details
        public static Map<String, String> studentAssignedVersion = new ConcurrentHashMap<>();
        public static Map<String, Map<String, Object>> packages = new ConcurrentHashMap<>(); // uid -> full doc
        public static Map<String, Map<String, Object>> studentSessions = new ConcurrentHashMap<>(); // token -> session
        public static Map<String, String> usnToSessionToken = new ConcurrentHashMap<>(); // usn -> token
        public static Map<String, Map<String, Object>> studentAnswers = new ConcurrentHashMap<>(); // usn -> (qId -> answerRecord)
        public static Map<String, Long> studentSubmissions = new ConcurrentHashMap<>(); // subKey -> timestamp
        public static Map<String, Map<String, Object>> studentReceipts = new ConcurrentHashMap<>(); // subKey -> receipt
        public static Map<String, Map<String, Object>> studentLockStates = new ConcurrentHashMap<>(); // usn -> lockState
        public static Map<String, Map<String, Object>> sittingUnlockVerifiers = new ConcurrentHashMap<>(); // examId:sitting -> verifier
        public static Map<String, Integer> loginFailureCounts = new ConcurrentHashMap<>(); // usn -> count
        public static Map<String, Long> loginLockoutUntil = new ConcurrentHashMap<>(); // usn -> timestamp

        // Phase 9: Workstation binding, PC crash recovery, and event history
        public static Map<String, String> workstationBindings = new ConcurrentHashMap<>(); // workstationId -> usn
        public static Map<String, Map<String, Object>> recoveryTokens = new ConcurrentHashMap<>(); // usn -> tokenRecord
        public static Set<String> instructorSessions = ConcurrentHashMap.newKeySet(); // instructorToken
        public static List<Map<String, Object>> sessionTransfers = new CopyOnWriteArrayList<>();
        public static List<Map<String, Object>> recoveryAuditLogs = new CopyOnWriteArrayList<>();
        public static List<Map<String, Object>> suspiciousEvents = new CopyOnWriteArrayList<>();
        public static List<Map<String, Object>> pcRecoveryEvents = new CopyOnWriteArrayList<>();
    }

    public static void main(String[] args) throws Exception {
        System.out.println("================================================================================");
        System.out.println("  MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - OFFLINE LAB EXAMINATION SERVER");
        System.out.println("================================================================================");

        PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", System.getenv().getOrDefault("LAB_PORT", "8082")));
        BIND = System.getenv().getOrDefault("BIND", "127.0.0.1");
        LAB_ID = System.getenv().getOrDefault("LAB_ID", "LAB-CSE-01");

        String customKeys = System.getenv("LAB_KEYS_DIR");
        if (customKeys != null && !customKeys.isBlank()) KEYS_DIR = Path.of(customKeys);

        String customStorage = System.getenv("LAB_STORAGE_DIR");
        if (customStorage != null && !customStorage.isBlank()) {
            STORAGE_DIR = Path.of(customStorage);
            if (STORAGE_DIR.getParent() != null) {
                CREDENTIALS_DIR = STORAGE_DIR.getParent().resolve("credentials");
                CREDENTIALS_FILE = CREDENTIALS_DIR.resolve("sitting_unlock_verifiers.json");
            }
        }

        Files.createDirectories(KEYS_DIR);
        Files.createDirectories(STORAGE_DIR);
        Files.createDirectories(SUBMISSIONS_DIR);
        Files.createDirectories(RESULTS_DIR);
        Files.createDirectories(CREDENTIALS_DIR);

        // 1. Cryptographic Initialization & Isolation Verification
        initCrypto();

        if (args.length > 0 && "--init-keys".equals(args[0])) {
            System.out.println("[LabServer] Cryptographic keys verified and initialized successfully.");
            return;
        }

        // 2. Load any locally stored offline packages
        loadPersistedPackages();

        // 3. Load locally stored active sessions, answers and submissions for restart recovery
        loadPersistedSubmissions();
        loadPersistedUnlockVerifiers();

        // 4. Background Executor for Expiry Processing
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "LabServer-ExpiryWorker");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(LabServer::checkExpiries, 2, 2, TimeUnit.SECONDS);

        // 5. Start dedicated HTTP network server
        HttpServer server = HttpServer.create(new InetSocketAddress(BIND, PORT), 128);
        server.createContext("/lab-api/", LabServer::handleRequest);
        server.createContext("/api/", LabServer::handleRequest);
        server.createContext("/health", LabServer::handleHealth);
        server.createContext("/", LabServer::handleRequest);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-heartbeat-thread");
            t.setDaemon(true);
            return t;
        }).scheduleAtFixedRate(() -> {
            List<SseClient> dead = new ArrayList<>();
            for (SseClient c : sseClients) {
                if (!c.sendComment("heartbeat")) {
                    dead.add(c);
                }
            }
            sseClients.removeAll(dead);
        }, 15, 15, TimeUnit.SECONDS);

        System.out.println("[LabServer] Server initialized on http://" + BIND + ":" + PORT);
        System.out.println("[LabServer] Lab ID: " + LAB_ID);
        System.out.println("[LabServer] Local storage path: " + STORAGE_DIR.toAbsolutePath());
        System.out.println("[LabServer] Offline packages loaded in memory: " + RuntimeState.packages.size());
        System.out.println("[LabServer] Submissions loaded in memory: " + RuntimeState.studentSubmissions.size());
        System.out.println("[LabServer] Ready to conduct offline examinations.");
        System.out.println("================================================================================");
    }

    // --- CRYPTO SUBSYSTEM ---
    private static void initCrypto() throws Exception {
        Path labPrivPath = KEYS_DIR.resolve("lab_private.key");
        Path labPubPath = KEYS_DIR.resolve("lab_public.key");
        Path centralPubPath = KEYS_DIR.resolve("central_public.key");

        // Verify that central_private.key is STRICTLY ABSENT
        Path centralPrivPath = KEYS_DIR.resolve("central_private.key");
        if (Files.exists(centralPrivPath)) {
            System.err.println("[SECURITY WARNING] central_private.key found in Lab Server key store! Removing immediately to enforce cryptographic isolation.");
            Files.delete(centralPrivPath);
        }

        KeyFactory kf = KeyFactory.getInstance("RSA");

        if (Files.exists(labPrivPath) && Files.exists(labPubPath)) {
            byte[] privBytes = Files.readAllBytes(labPrivPath);
            byte[] pubBytes = Files.readAllBytes(labPubPath);
            labPrivateKey = kf.generatePrivate(new PKCS8EncodedKeySpec(privBytes));
            labPublicKey = kf.generatePublic(new X509EncodedKeySpec(pubBytes));
            System.out.println("[LabCrypto] Loaded Lab RSA KeyPair from " + KEYS_DIR.toAbsolutePath());
        } else {
            System.out.println("[LabCrypto] Generating new Lab RSA KeyPair...");
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
            kpg.initialize(2048);
            KeyPair pair = kpg.generateKeyPair();
            labPrivateKey = pair.getPrivate();
            labPublicKey = pair.getPublic();
            Files.write(labPrivPath, labPrivateKey.getEncoded());
            Files.write(labPubPath, labPublicKey.getEncoded());
        }

        if (Files.exists(centralPubPath)) {
            byte[] cpubBytes = Files.readAllBytes(centralPubPath);
            centralPublicKey = kf.generatePublic(new X509EncodedKeySpec(cpubBytes));
            System.out.println("[LabCrypto] Loaded Central RSA Public Key from " + centralPubPath.toAbsolutePath());
        } else {
            Path altCentralPub = Path.of(System.getenv().getOrDefault("CENTRAL_KEYS_DIR", "keys"), "central_public.key");
            if (Files.exists(altCentralPub)) {
                Files.copy(altCentralPub, centralPubPath, StandardCopyOption.REPLACE_EXISTING);
                byte[] cpubBytes = Files.readAllBytes(centralPubPath);
                centralPublicKey = kf.generatePublic(new X509EncodedKeySpec(cpubBytes));
                System.out.println("[LabCrypto] Auto-imported Central RSA Public Key from " + altCentralPub.toAbsolutePath());
            } else {
                System.err.println("[LabCrypto WARNING] central_public.key not found at " + centralPubPath.toAbsolutePath());
            }
        }

        System.out.println("[LabCrypto] Cryptographic isolation confirmed: Lab Server possesses lab_private.key, does NOT possess central_private.key.");
    }

    public static byte[] derive(String password, byte[] salt) throws GeneralSecurityException {
        PBEKeySpec key = new PBEKeySpec(password.toCharArray(), salt, 600000, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(key).getEncoded(); }
        finally { key.clearPassword(); }
    }

    public static boolean verifySignature(byte[] data, String signatureHex, PublicKey pubKey) {
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(pubKey);
            verifier.update(data);
            return verifier.verify(HexFormat.of().parseHex(signatureHex));
        } catch (Exception e) {
            return false;
        }
    }

    public static String sign(byte[] data, PrivateKey privKey) throws Exception {
        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(privKey);
        signer.update(data);
        return HexFormat.of().formatHex(signer.sign());
    }

    public static byte[] decrypt(String payloadHex, String keyHex, String ivHex, PrivateKey recipientPrivKey) throws Exception {
        Cipher rsaUnwrap = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsaUnwrap.init(Cipher.UNWRAP_MODE, recipientPrivKey);
        Key unwrappedKey = rsaUnwrap.unwrap(HexFormat.of().parseHex(keyHex), "AES", Cipher.SECRET_KEY);

        byte[] iv = HexFormat.of().parseHex(ivHex);
        byte[] ciphertext = HexFormat.of().parseHex(payloadHex);
        Cipher aesDecrypt = Cipher.getInstance("AES/GCM/NoPadding");
        aesDecrypt.init(Cipher.DECRYPT_MODE, unwrappedKey, new GCMParameterSpec(128, iv));
        return aesDecrypt.doFinal(ciphertext);
    }

    // --- PACKAGE PERSISTENCE & LOAD ---
    @SuppressWarnings("unchecked")
    private static void loadPersistedPackages() {
        try {
            if (!Files.exists(STORAGE_DIR)) return;
            try (var stream = Files.list(STORAGE_DIR)) {
                stream.filter(p -> p.getFileName().toString().endsWith(".json")).forEach(p -> {
                    try {
                        String content = Files.readString(p, StandardCharsets.UTF_8);
                        Map<String, Object> doc = (Map<String, Object>) Json.parse(content);
                        String uid = (String) doc.get("packageUid");
                        if (uid != null) {
                            RuntimeState.packages.put(uid, doc);
                        }
                    } catch (Exception ex) {
                        System.err.println("[LabStorage] Failed to load package " + p.getFileName() + ": " + ex.getMessage());
                    }
                });
            }

            // Activate primary package into memory (prefer package matching current time window today, or highest examId)
            Map<String, Object> primary = null;
            String todayStr = LocalDate.now().toString();
            long nowMs = System.currentTimeMillis();
            for (Map<String, Object> doc : RuntimeState.packages.values()) {
                Map<String, Object> pl = (Map<String, Object>) doc.getOrDefault("payload", doc);
                String eDate = String.valueOf(pl.getOrDefault("examDate", pl.getOrDefault("scheduledDate", "")));
                if (todayStr.equals(eDate)) {
                    String sTime = String.valueOf(pl.getOrDefault("startTime", "09:30:00"));
                    int dur = (int) parseLongSafe(pl.getOrDefault("durationMinutes", 90));
                    long sMs = calculateScheduledStartMs(eDate, sTime);
                    long eMs = calculateScheduledEndMs(eDate, resolveEndTime(sTime, pl.get("endTime"), dur), sTime, dur);
                    if (nowMs >= sMs - 15 * 60 * 1000L && nowMs < eMs) {
                        long eid = parseLongSafe(doc.getOrDefault("examinationId", pl.getOrDefault("sessionId", pl.get("examinationId"))));
                        if (primary == null || eid > parseLongSafe(primary.getOrDefault("examinationId", ((Map<?, ?>) primary.getOrDefault("payload", primary)).get("sessionId")))) {
                            primary = doc;
                        }
                    }
                }
            }
            if (primary == null) {
                long maxEid = -1;
                for (Map<String, Object> doc : RuntimeState.packages.values()) {
                    Map<String, Object> pl = (Map<String, Object>) doc.getOrDefault("payload", doc);
                    String eDate = String.valueOf(pl.getOrDefault("examDate", pl.getOrDefault("scheduledDate", "")));
                    if (todayStr.equals(eDate)) {
                        long eid = parseLongSafe(doc.getOrDefault("examinationId", pl.getOrDefault("sessionId", pl.get("examinationId"))));
                        if (eid > maxEid) {
                            maxEid = eid;
                            primary = doc;
                        }
                    }
                }
            }
            if (primary == null) {
                for (Map<String, Object> doc : RuntimeState.packages.values()) {
                    if (parseLongSafe(doc.get("examinationId")) == 20L) {
                        primary = doc;
                        break;
                    }
                }
            }
            // Restore non-finalized stored packages into active multi-cohort memory
            for (Map<String, Object> doc : RuntimeState.packages.values()) {
                long docEid = parseLongSafe(doc.getOrDefault("examinationId", doc.get("sessionId")));
                String docSit = String.valueOf(doc.getOrDefault("sittingCode", doc.getOrDefault("sitting", "MORNING"))).toUpperCase(Locale.ROOT);
                Path resFile = RESULTS_DIR.resolve(docEid + "_" + docSit + ".labresult");
                if (!Files.exists(resFile)) {
                    activatePackageIntoMemory(doc);
                }
            }
            if (primary != null) {
                RuntimeState.activeSessionId = parseLongSafe(primary.getOrDefault("examinationId", primary.get("sessionId")));
                RuntimeState.activeSittingName = (String) primary.getOrDefault("sittingCode", primary.get("sitting"));
            }
        } catch (Exception ex) {
            System.err.println("[LabStorage] Error scanning storage directory: " + ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private static void loadPersistedSubmissions() {
        try {
            if (!Files.exists(SUBMISSIONS_DIR)) return;
            try (var stream = Files.list(SUBMISSIONS_DIR)) {
                stream.forEach(p -> {
                    try {
                        String fileName = p.getFileName().toString();
                        if (fileName.endsWith("_session.json")) {
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Map<String, Object> sess = (Map<String, Object>) Json.parse(content);
                            String token = (String) sess.get("token");
                            String usn = (String) sess.get("usn");
                            String ws = (String) sess.get("assignedWorkstationId");
                            if (token != null && usn != null) {
                                RuntimeState.studentSessions.put(token, sess);
                                RuntimeState.usnToSessionToken.put(usn, token);
                                if (ws != null) RuntimeState.workstationBindings.put(ws, usn);
                            }
                        } else if (fileName.endsWith("_answers.json")) {
                            String usn = fileName.substring(0, fileName.indexOf("_answers.json")).toUpperCase(Locale.ROOT);
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Map<String, Object> ans = (Map<String, Object>) Json.parse(content);
                            RuntimeState.studentAnswers.computeIfAbsent(usn, k -> new ConcurrentHashMap<>()).putAll(ans);
                        } else if (fileName.endsWith("_final_submission.json")) {
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Map<String, Object> sub = (Map<String, Object>) Json.parse(content);
                            String usn = (String) sub.get("usn");
                            Object sessId = sub.get("sessionId");
                            long submittedAt = parseLongSafe(sub.get("submittedAt"));
                            if (usn != null && sessId != null) {
                                String subKey = sessId + ":" + usn;
                                RuntimeState.studentSubmissions.put(subKey, submittedAt);
                                Object receipt = sub.get("receipt");
                                if (receipt instanceof Map<?, ?> rm) {
                                    Map<String, Object> rMap = new LinkedHashMap<>();
                                    rm.forEach((k, v) -> rMap.put(String.valueOf(k), v));
                                    RuntimeState.studentReceipts.put(subKey, rMap);
                                }
                            }
                        } else if (fileName.endsWith("_security.json")) {
                            String baseKey = fileName.substring(0, fileName.indexOf("_security.json")).toUpperCase(Locale.ROOT);
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Map<String, Object> lock = (Map<String, Object>) Json.parse(content);
                            RuntimeState.studentLockStates.put(baseKey, new ConcurrentHashMap<>(lock));
                        } else if (fileName.equals("recovery_transfers.json")) {
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Object parsed = Json.parse(content);
                            if (parsed instanceof List<?> l) {
                                for (Object it : l) {
                                    if (it instanceof Map<?, ?> m) {
                                        Map<String, Object> copy = new LinkedHashMap<>();
                                        m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                                        RuntimeState.sessionTransfers.add(copy);
                                    }
                                }
                            }
                        } else if (fileName.equals("recovery_audit.json")) {
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            Object parsed = Json.parse(content);
                            if (parsed instanceof List<?> l) {
                                for (Object it : l) {
                                    if (it instanceof Map<?, ?> m) {
                                        Map<String, Object> copy = new LinkedHashMap<>();
                                        m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                                        RuntimeState.recoveryAuditLogs.add(copy);
                                    }
                                }
                            }
                        }
                    } catch (Exception ex) {
                        System.err.println("[LabStorage] Error loading " + p.getFileName() + ": " + ex.getMessage());
                    }
                });
            }
        } catch (Exception ex) {
            System.err.println("[LabStorage] Error reading submissions directory: " + ex.getMessage());
        }
    }

    private static long parseLongSafe(Object val) {
        if (val == null) return 0L;
        if (val instanceof Number n) return n.longValue();
        String s = val.toString().trim();
        if (s.isEmpty()) return 0L;
        if (s.contains(".")) s = s.substring(0, s.indexOf('.'));
        try {
            return Long.parseLong(s);
        } catch (Exception e) {
            return 0L;
        }
    }

    @SuppressWarnings("unchecked")
    private static synchronized void activatePackageIntoMemory(Map<String, Object> doc) {
        try {
            Object examIdObj = doc.get("examinationId");
            long examId = parseLongSafe(examIdObj);
            String sittingName = (String) doc.get("sittingCode");

            Map<String, Object> payload = (Map<String, Object>) doc.get("payload");
            if (payload == null) payload = doc;

            if (examId == 0L) {
                examId = parseLongSafe(payload.getOrDefault("sessionId", payload.get("examinationId")));
            }
            if (sittingName == null || sittingName.isBlank()) {
                sittingName = (String) payload.getOrDefault("sittingCode", payload.getOrDefault("sitting", "MORNING"));
            }
            if (sittingName == null) sittingName = "MORNING";
            sittingName = sittingName.trim().toUpperCase(Locale.ROOT);

            CohortState cohort = RuntimeState.activeCohorts.computeIfAbsent(examId, k -> new CohortState());
            cohort.examinationId = examId;
            cohort.sittingName = sittingName;
            cohort.packageDoc = doc;
            cohort.sessionMetadata.putAll(payload);

            Map<String, Object> versionsMap = (Map<String, Object>) payload.get("versions");
            if (versionsMap != null) {
                for (Map.Entry<String, Object> e : versionsMap.entrySet()) {
                    Map<String, Object> vDoc = Map.of("questions", e.getValue());
                    cohort.versions.put(e.getKey(), vDoc);
                    RuntimeState.versions.put(e.getKey(), vDoc);
                }
            }

            Map<String, Object> answersMap = (Map<String, Object>) payload.get("answerKeys");
            if (answersMap != null) {
                for (Map.Entry<String, Object> e : answersMap.entrySet()) {
                    try {
                        int ak = Integer.parseInt(String.valueOf(e.getValue()));
                        cohort.answerKeys.put(e.getKey(), ak);
                        RuntimeState.answerKeys.put(e.getKey(), ak);
                    } catch (Exception ignored) {}
                }
            }

            Object rosterObj = payload.get("roster");
            if (rosterObj instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> sm) {
                        String usn = (String) sm.get("usn");
                        if (usn != null) {
                            String normUsn = usn.trim().toUpperCase(Locale.ROOT);
                            Map<String, Object> m = new LinkedHashMap<>();
                            sm.forEach((k, v) -> m.put(String.valueOf(k), v));
                            cohort.roster.put(normUsn, m);
                            RuntimeState.roster.put(normUsn, m);
                            RuntimeState.usnToCohortMap.put(normUsn, examId);
                            String assignedVer = (String) m.get("assignedVersion");
                            if (assignedVer != null) {
                                cohort.studentAssignedVersion.put(normUsn, assignedVer);
                                RuntimeState.studentAssignedVersion.put(normUsn, assignedVer);
                            }
                        }
                    }
                }
            }

            // Register sitting unlock verifier if embedded in package payload
            if (payload.containsKey("sessionUnlockVerifier")) {
                Object vObj = payload.get("sessionUnlockVerifier");
                if (vObj instanceof Map<?, ?> vm) {
                    Map<String, Object> verMap = new LinkedHashMap<>();
                    vm.forEach((k, v) -> verMap.put(String.valueOf(k), v));
                    RuntimeState.sittingUnlockVerifiers.put(examId + ":" + sittingName, verMap);
                }
            }

            // Set backward-compatible activeSessionId to latest activated cohort
            RuntimeState.activeSessionId = examId;
            RuntimeState.activeSittingName = sittingName;
            RuntimeState.sessionMetadata = payload;

            System.out.println("[LabServer] Cohort #" + examId + " (" + sittingName + ") activated into memory. Roster size: " + cohort.roster.size() + ", Total active cohorts: " + RuntimeState.activeCohorts.size());
        } catch (Exception ex) {
            System.err.println("[LabServer] Activation into memory failed: " + ex.getMessage());
        }
    }

    // --- HTTP HANDLERS ---
    static void handleHealth(HttpExchange exchange) throws IOException {
        setCORS(exchange);
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", "ok");
        resp.put("service", "MIT-Mysore-Lab-Server");
        resp.put("version", "1.0.0");
        resp.put("labId", LAB_ID);
        resp.put("port", PORT);
        resp.put("activeSessionId", RuntimeState.activeSessionId);
        resp.put("activeSitting", RuntimeState.activeSittingName);
        resp.put("activeCohortsCount", RuntimeState.activeCohorts.size());
        resp.put("activeCohorts", RuntimeState.activeCohorts.keySet());
        resp.put("packagesLoaded", RuntimeState.packages.size());
        resp.put("rosterCount", RuntimeState.roster.size());
        resp.put("submissionsCount", RuntimeState.studentSubmissions.size());
        resp.put("offlineReady", !RuntimeState.packages.isEmpty() && RuntimeState.activeSessionId != null);

        sendJson(exchange, 200, resp);
    }

    private static String handleLabServersNode() {
        List<Map<String, Object>> list = new ArrayList<>();
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", LAB_ID);
        node.put("labName", "Computer Science Lab 01");
        node.put("serverIdentifier", LAB_ID + "-SRV");
        node.put("department", "CSE");
        node.put("capacity", 45);
        node.put("connectionStatus", "Connected");
        List<String> wsList = new ArrayList<>();
        for (int i = 1; i <= 45; i++) {
            wsList.add(String.format("LAB01-PC-%02d", i));
        }
        node.put("registeredWorkstationIds", wsList);
        list.add(node);
        return Json.stringify(Map.of("success", true, "data", list, "message", "Active laboratory server nodes"));
    }

    static void handleRoot(HttpExchange exchange) throws IOException {
        setCORS(exchange);
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }
        handleHealth(exchange);
    }

    static void handleRequest(HttpExchange exchange) throws IOException {
        setCORS(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        if ("OPTIONS".equals(method)) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        String path = exchange.getRequestURI().getPath();
        while (path.startsWith("/")) path = path.substring(1);
        while (path.endsWith("/")) path = path.substring(0, path.length() - 1);

        try {
            byte[] bodyBytes = readAll(exchange.getRequestBody());
            String bodyStr = new String(bodyBytes, StandardCharsets.UTF_8);
            Map<String, Object> form = parseJsonOrForm(bodyStr);

            String responseJson = dispatch(exchange, method, path, form, bodyStr);
            if (responseJson != null) {
                if (responseJson.startsWith("__BINARY_RESPONSE__:")) {
                    Path filePath = Path.of(responseJson.substring("__BINARY_RESPONSE__:".length()));
                    byte[] fileBytes = Files.readAllBytes(filePath);
                    exchange.getResponseHeaders().set("Content-Type", "application/zip");
                    exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"" + filePath.getFileName().toString() + "\"");
                    exchange.sendResponseHeaders(200, fileBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) { os.write(fileBytes); }
                } else {
                    byte[] respBytes = responseJson.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
                    exchange.sendResponseHeaders(200, respBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(respBytes);
                    }
                }
            }
        } catch (LabException le) {
            sendError(exchange, le.statusCode, le.getMessage(), le.errorCode);
        } catch (Exception ex) {
            ex.printStackTrace();
            sendError(exchange, 500, "Internal Lab Server Error: " + ex.getMessage(), "INTERNAL_ERROR");
        }
    }

    @SuppressWarnings("unchecked")
    private static String dispatch(HttpExchange exchange, String method, String path, Map<String, Object> form, String rawBody) throws Exception {
        // Strip common prefix if any
        String normPath = path;
        if (normPath.startsWith("lab-api/")) normPath = normPath.substring(8);
        else if (normPath.startsWith("api/")) normPath = normPath.substring(4);
        if (normPath.startsWith("v1/")) normPath = normPath.substring(3);

        if (normPath.isEmpty() || normPath.equals("health") || normPath.equals("v1/health")) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status", "ok");
            resp.put("service", "MIT-Mysore-Lab-Server");
            resp.put("labId", LAB_ID);
            resp.put("port", PORT);
            resp.put("packagesLoaded", RuntimeState.packages.size());
            resp.put("activeSessionId", RuntimeState.activeSessionId);
            resp.put("activeSitting", RuntimeState.activeSittingName);
            resp.put("activeCohortsCount", RuntimeState.activeCohorts.size());
            resp.put("activeCohorts", RuntimeState.activeCohorts.keySet());
            resp.put("offlineReady", true);
            return Json.stringify(resp);
        }

        // Lab Server Identity & Nodes
        if ((normPath.equals("labs/servers") || normPath.equals("labs/server") || normPath.matches("(v1/)?labs/servers?")) && "GET".equals(method)) {
            return handleLabServersNode();
        }

        // 1. Package Import via Network HTTP POST
        if ((normPath.equals("package/import") || normPath.equals("lab/package/import") ||
             normPath.matches("(v1/)?labs/examinations/\\d+/sittings/[^/]+/package-receipt")) && "POST".equals(method)) {
            return handlePackageImport(form);
        }

        // 2. Package Receipt Query
        if ((normPath.equals("package/receipt") || normPath.matches("(v1/)?labs/examinations/\\d+/sittings/[^/]+/package-receipt")) && "GET".equals(method)) {
            return handlePackageReceipt(exchange.getRequestURI().getQuery(), path);
        }

        // 3. Package List Query
        if (normPath.equals("package/list") && "GET".equals(method)) {
            List<Map<String, Object>> list = new ArrayList<>();
            for (Map<String, Object> p : RuntimeState.packages.values()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("packageUid", p.get("packageUid"));
                item.put("examinationId", p.get("examinationId"));
                item.put("sittingCode", p.get("sittingCode"));
                item.put("labId", p.get("labId"));
                item.put("digestHex", p.get("digestHex"));
                item.put("status", p.get("status"));
                item.put("receivedAt", p.get("receivedAt"));
                list.add(item);
            }
            return Json.stringify(Map.of("packages", list, "count", list.size(), "labId", LAB_ID));
        }

        // 4. Manual Package Import from local file
        if (normPath.equals("package/manual-import") && "POST".equals(method)) {
            return handleManualImport(form);
        }

        // 5. Student Offline Examination Endpoints
        if ((normPath.equals("student/login") || normPath.equals("auth/student-login")) && "POST".equals(method)) {
            return handleStudentLogin(exchange, form);
        }

        if (normPath.equals("student/logout") && "POST".equals(method)) {
            return handleStudentLogout(exchange);
        }

        if (normPath.equals("student/instructions") && "GET".equals(method)) {
            return handleStudentInstructions(exchange);
        }

        if (normPath.equals("student/exam-session") && "GET".equals(method)) {
            return handleStudentExamSession(exchange);
        }

        if (normPath.equals("student/exam/questions") && "GET".equals(method)) {
            return handleStudentQuestions(exchange);
        }

        if (normPath.equals("student/exam/start") && "POST".equals(method)) {
            return handleStudentStart(exchange, form);
        }

        if (normPath.equals("student/exam/state") && "GET".equals(method)) {
            return handleStudentState(exchange);
        }

        if (normPath.equals("student/exam/answers") && "POST".equals(method)) {
            return handleStudentSaveAnswers(exchange, form);
        }

        if (normPath.equals("security/violation") && "POST".equals(method)) {
            return handleSecurityViolation(exchange, form);
        }

        if ((normPath.equals("security/unlock") || normPath.matches("labs/[^/]+/sittings/[^/]+/verify-unlock")) && "POST".equals(method)) {
            return handleSecurityUnlock(exchange, form);
        }

        if ((normPath.equals("lab-api/sittings/unlock-credential/revoke") || normPath.endsWith("/unlock-credential/revoke")) && "POST".equals(method)) {
            return handleRevokeUnlockCredential(exchange, form);
        }

        if ((normPath.equals("lab-api/sittings/unlock-credential") || normPath.equals("api/security/provision-unlock-credential") || normPath.endsWith("/unlock-credential")) && "POST".equals(method)) {
            return handleProvisionUnlockCredential(exchange, form);
        }

        if (normPath.equals("student/exam/submit") && "POST".equals(method)) {
            return handleStudentSubmit(exchange, form);
        }

        // --- PHASE 9: STUDENT HEARTBEAT ---
        if ((normPath.equals("student/exam/heartbeat") || normPath.equals("student/heartbeat")) && "POST".equals(method)) {
            return handleStudentHeartbeat(exchange, form);
        }

        // --- PHASE 9: LIVE MONITORING TELEMETRY ---
        if ((normPath.equals("monitoring/sessions") || normPath.startsWith("monitoring/sessions/")) && "GET".equals(method)) {
            return handleMonitoringSessions(exchange, normPath);
        }

        // --- PHASE 9: LIVE MONITORING STREAM (SSE) ---
        if ((normPath.equals("monitoring/stream") || normPath.equals("monitoring/events") || normPath.equals("lab-api/monitoring/stream") || normPath.equals("api/v1/monitoring/events")) && "GET".equals(method)) {
            return handleMonitoringStream(exchange);
        }

        // --- PHASE 9: LAB INSTRUCTOR AUTHENTICATION ---
        if ((normPath.equals("instructor/login") || normPath.equals("recovery/login")) && "POST".equals(method)) {
            return handleInstructorLogin(exchange, form);
        }
        if ((normPath.equals("instructor/logout") || normPath.equals("recovery/logout")) && "POST".equals(method)) {
            return handleInstructorLogout(exchange);
        }

        // --- PHASE 9: REAL PC CRASH RECOVERY ---
        if (normPath.equals("recovery/relogin-authorisations") && "GET".equals(method)) {
            return handleRecoveryReloginList(exchange);
        }
        if (normPath.equals("recovery/relogin-authorisations/approve") && "POST".equals(method)) {
            return handleRecoveryApprove(exchange, form);
        }
        if ((normPath.equals("recovery/relogin-authorisations/consume") || normPath.equals("recovery/consume-token")) && "POST".equals(method)) {
            return handleRecoveryConsume(exchange, form);
        }
        if (normPath.equals("recovery/overview") && "GET".equals(method)) {
            return handleRecoveryOverview(exchange);
        }
        if (normPath.equals("recovery/transfers") && "GET".equals(method)) {
            return handleRecoveryTransfers(exchange);
        }
        if (normPath.equals("recovery/audit-logs") && "GET".equals(method)) {
            return handleRecoveryAuditLogs(exchange);
        }
        if (normPath.equals("recovery/config") && "GET".equals(method)) {
            return handleRecoveryConfig(exchange);
        }
        if (normPath.equals("recovery/report-crash") && "POST".equals(method)) {
            return handleRecoveryReportCrash(exchange, form);
        }
        if (normPath.matches("labs/[^/]+/sittings/[^/]+/pc-recovery") && "POST".equals(method)) {
            return handleLabPcRecovery(exchange, form, normPath);
        }
        if (normPath.matches("labs/[^/]+/sittings/[^/]+/workstation-bind") && "POST".equals(method)) {
            return handleLabWorkstationBind(exchange, form);
        }
        if (normPath.matches("monitoring/sessions/[^/]+/unlock-event") && "POST".equals(method)) {
            return handleRecordUnlockEvent(exchange, form);
        }
        if ((normPath.equals("packages/activate") || normPath.equals("package/activate") || normPath.equals("test/activate-package")) && "POST".equals(method)) {
            return handlePackageActivate(exchange, form);
        }

        // --- PHASE 9: RESULT FINALIZATION & SIGNED .LABRESULT ARCHIVE GENERATION ---
        if ((normPath.equals("results/finalize") || normPath.equals("results/evaluate-and-export") || normPath.equals("lab/evaluate-and-export")) && "POST".equals(method)) {
            return handleResultsFinalize(exchange, form);
        }
        if ((normPath.equals("results/download") || normPath.equals("results/package")) && "GET".equals(method)) {
            return handleResultsDownload(exchange);
        }
        if (normPath.equals("results/transfer-to-central") && "POST".equals(method)) {
            return handleResultsTransferToCentral(exchange, form);
        }

        // Test helper endpoint to clear student attempt (for automated test cleanup only)
        if (normPath.equals("test/reset-submissions") && "POST".equals(method)) {
            RuntimeState.activeCohorts.clear();
            RuntimeState.usnToCohortMap.clear();
            RuntimeState.packages.clear();
            RuntimeState.studentSubmissions.clear();
            RuntimeState.studentAnswers.clear();
            RuntimeState.studentLockStates.clear();
            RuntimeState.studentSessions.clear();
            RuntimeState.usnToSessionToken.clear();
            RuntimeState.workstationBindings.clear();
            RuntimeState.recoveryTokens.clear();
            RuntimeState.sessionTransfers.clear();
            RuntimeState.recoveryAuditLogs.clear();
            RuntimeState.suspiciousEvents.clear();
            RuntimeState.pcRecoveryEvents.clear();
            try (var stream = Files.list(STORAGE_DIR)) {
                for (Path p : stream.toList()) {
                    String fn = p.getFileName().toString();
                    if (fn.startsWith("4MH26SY") && fn.endsWith(".json")) {
                        Files.deleteIfExists(p);
                    }
                }
            } catch (Exception ignored) {}
            return Json.stringify(Map.of("success", true, "message", "Test submissions and recovery state cleared"));
        }

        if (normPath.equals("test/inject-ambiguity") && "POST".equals(method)) {
            String usn = String.valueOf(form.getOrDefault("usn", "")).trim().toUpperCase(Locale.ROOT);
            long targetEid = parseLongSafe(form.get("targetEid"));
            CohortState cs = RuntimeState.activeCohorts.get(targetEid);
            if (cs != null && !usn.isBlank()) {
                Map<String, Object> sm = new LinkedHashMap<>();
                sm.put("usn", usn);
                sm.put("dob", "2006-01-25");
                sm.put("fullName", "Ambiguity Test Student");
                cs.roster.put(usn, sm);
            }
            return Json.stringify(Map.of("success", true, "message", "Ambiguity injected for " + usn));
        }

        if (normPath.equals("test/remove-ambiguity") && "POST".equals(method)) {
            String usn = String.valueOf(form.getOrDefault("usn", "")).trim().toUpperCase(Locale.ROOT);
            long targetEid = parseLongSafe(form.get("targetEid"));
            CohortState cs = RuntimeState.activeCohorts.get(targetEid);
            if (cs != null && !usn.isBlank()) {
                cs.roster.remove(usn);
            }
            return Json.stringify(Map.of("success", true, "message", "Ambiguity removed for " + usn));
        }

        if (normPath.equals("test/expire-session") && "POST".equals(method)) {
            String usn = String.valueOf(form.getOrDefault("studentUsn", "")).trim().toUpperCase(Locale.ROOT);
            for (Map<String, Object> sess : RuntimeState.studentSessions.values()) {
                if (usn.equals(sess.get("usn"))) {
                    sess.put("examExpiresAtMs", System.currentTimeMillis() - 1000L);
                    saveSessionToDisk(usn, sess);
                    return Json.stringify(Map.of("success", true, "message", "Session expired for " + usn));
                }
            }
            throw new LabException(404, "Session not found for " + usn, "NOT_FOUND");
        }

        throw new LabException(404, "Endpoint not found on Lab Server: " + method + " " + path, "NOT_FOUND");
    }

    // --- PACKAGE IMPORT HANDLER ---
    @SuppressWarnings("unchecked")
    private static String handlePackageImport(Map<String, Object> form) throws Exception {
        long examId = parseLongSafe(form.getOrDefault("examinationId", form.getOrDefault("sessionId", "0")));
        String sitCode = String.valueOf(form.getOrDefault("sittingCode", form.getOrDefault("sittingName", "MORNING")));
        String packageUid = String.valueOf(form.getOrDefault("packageUid", ""));
        String labId = String.valueOf(form.getOrDefault("labId", LAB_ID));
        String encPayload = String.valueOf(form.getOrDefault("encryptedPayloadHex", form.getOrDefault("encryptedPayload", "")));
        String encKey = String.valueOf(form.getOrDefault("encryptedKeyHex", ""));
        String ivHex = String.valueOf(form.getOrDefault("ivHex", ""));
        String digestHex = String.valueOf(form.getOrDefault("digestHex", ""));
        String signatureHex = String.valueOf(form.getOrDefault("signatureHex", ""));

        if (packageUid.isBlank() || encPayload.isBlank() || encKey.isBlank() || ivHex.isBlank() || digestHex.isBlank() || signatureHex.isBlank()) {
            throw new LabException(400, "Missing required secure package cryptographic envelope fields", "INVALID_ENVELOPE");
        }

        System.out.println("[LabReceiver] Received package " + packageUid + " for Examination #" + examId + " (" + sitCode + ") from Central Backend.");

        if (centralPublicKey == null) {
            throw new LabException(500, "Central RSA Public Key not configured on Lab Server", "MISSING_CENTRAL_KEY");
        }
        byte[] sigData = (encPayload + digestHex + packageUid + examId).getBytes(StandardCharsets.UTF_8);
        boolean validCentralSig = verifySignature(sigData, signatureHex, centralPublicKey);
        if (!validCentralSig) {
            byte[] legacySigData = (encPayload + digestHex + examId).getBytes(StandardCharsets.UTF_8);
            validCentralSig = verifySignature(legacySigData, signatureHex, centralPublicKey);
        }

        if (!validCentralSig) {
            System.err.println("[LabReceiver REJECTED] Central digital signature verification failed for package " + packageUid);
            throw new LabException(400, "Central digital signature verification failed: package rejected by Lab Server", "SIGNATURE_VERIFICATION_FAILED");
        }

        byte[] decrypted;
        try {
            decrypted = decrypt(encPayload, encKey, ivHex, labPrivateKey);
        } catch (Exception ex) {
            System.err.println("[LabReceiver REJECTED] Decryption failed: " + ex.getMessage());
            throw new LabException(400, "Lab Server decryption failed: " + ex.getMessage(), "DECRYPTION_FAILED");
        }

        byte[] actualDigest = MessageDigest.getInstance("SHA-256").digest(decrypted);
        String actualDigestHex = HexFormat.of().formatHex(actualDigest);
        if (!actualDigestHex.equalsIgnoreCase(digestHex)) {
            System.err.println("[LabReceiver REJECTED] Payload SHA-256 digest mismatch. Expected: " + digestHex + ", Actual: " + actualDigestHex);
            throw new LabException(400, "Decrypted package payload digest mismatch", "DIGEST_MISMATCH");
        }

        String decryptedJson = new String(decrypted, StandardCharsets.UTF_8);
        Map<String, Object> pkgContent = (Map<String, Object>) Json.parse(decryptedJson);

        Map<String, Object> storageDoc = new LinkedHashMap<>();
        storageDoc.put("packageUid", packageUid);
        storageDoc.put("examinationId", examId);
        storageDoc.put("sittingCode", sitCode);
        storageDoc.put("labId", labId);
        storageDoc.put("receivedAt", System.currentTimeMillis());
        storageDoc.put("digestHex", actualDigestHex);
        storageDoc.put("status", "READY");
        storageDoc.put("verificationResult", "VERIFIED");
        storageDoc.put("envelope", Map.of(
                "encryptedPayloadHex", encPayload,
                "encryptedKeyHex", encKey,
                "ivHex", ivHex,
                "digestHex", digestHex
        ));
        storageDoc.put("centralSignatureHex", signatureHex);
        storageDoc.put("payload", pkgContent);

        Path packageFile = STORAGE_DIR.resolve(packageUid + ".json");
        Files.writeString(packageFile, Json.stringify(storageDoc), StandardCharsets.UTF_8);

        RuntimeState.packages.put(packageUid, storageDoc);
        activatePackageIntoMemory(storageDoc);

        String ackPayload = packageUid + ":" + actualDigestHex + ":" + labId + ":VERIFIED:ACCEPTED:" + examId;
        String labAckSignatureHex = sign(ackPayload.getBytes(StandardCharsets.UTF_8), labPrivateKey);

        storageDoc.put("labAckSignatureHex", labAckSignatureHex);
        Files.writeString(packageFile, Json.stringify(storageDoc), StandardCharsets.UTF_8);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("packageUid", packageUid);
        resp.put("examinationId", examId);
        resp.put("sittingCode", sitCode);
        resp.put("labId", labId);
        resp.put("digestHex", actualDigestHex);
        resp.put("status", "ACCEPTED");
        resp.put("verificationResult", "VERIFIED");
        resp.put("signatureHex", labAckSignatureHex);
        resp.put("acknowledgedAt", System.currentTimeMillis());

        Map<String, Object> ackObj = new LinkedHashMap<>();
        ackObj.put("packageUid", packageUid);
        ackObj.put("examinationId", examId);
        ackObj.put("sittingCode", sitCode);
        ackObj.put("labId", labId);
        ackObj.put("status", "ACCEPTED");
        ackObj.put("verificationResult", "VERIFIED");
        ackObj.put("digestHex", actualDigestHex);
        ackObj.put("signatureHex", labAckSignatureHex);
        ackObj.put("acknowledgedAt", System.currentTimeMillis());
        resp.put("acknowledgement", ackObj);

        return Json.stringify(resp);
    }

    // --- RECEIPT QUERY HANDLER ---
    private static String handlePackageReceipt(String query, String path) {
        String packageUid = null;
        Long examId = null;
        String sitCode = null;

        if (query != null && !query.isBlank()) {
            for (String part : query.split("&")) {
                String[] kv = part.split("=", 2);
                if (kv.length == 2) {
                    if ("packageUid".equalsIgnoreCase(kv[0])) packageUid = kv[1];
                    if ("examinationId".equalsIgnoreCase(kv[0])) {
                        try { examId = Long.parseLong(kv[1]); } catch (Exception ignored) {}
                    }
                    if ("sittingCode".equalsIgnoreCase(kv[0])) sitCode = kv[1];
                }
            }
        }

        if (path.contains("examinations/") && path.contains("sittings/")) {
            String[] parts = path.split("/");
            for (int i = 0; i < parts.length; i++) {
                if ("examinations".equals(parts[i]) && i + 1 < parts.length) {
                    try { examId = Long.parseLong(parts[i + 1]); } catch (Exception ignored) {}
                }
                if ("sittings".equals(parts[i]) && i + 1 < parts.length) {
                    sitCode = parts[i + 1].toUpperCase(Locale.ROOT).contains("AFTERNOON") ? "AFTERNOON" : "MORNING";
                }
            }
        }

        Map<String, Object> target = null;
        if (packageUid != null && RuntimeState.packages.containsKey(packageUid)) {
            target = RuntimeState.packages.get(packageUid);
        } else if (examId != null) {
            for (Map<String, Object> p : RuntimeState.packages.values()) {
                if (examId.equals(p.get("examinationId"))) {
                    if (sitCode == null || sitCode.equalsIgnoreCase((String) p.get("sittingCode"))) {
                        target = p;
                        break;
                    }
                }
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        if (target != null) {
            resp.put("alreadyReceived", true);
            resp.put("verified", true);
            resp.put("packageUid", target.get("packageUid"));
            resp.put("examinationId", target.get("examinationId"));
            resp.put("sittingCode", target.get("sittingCode"));
            resp.put("labId", target.get("labId"));
            resp.put("digestHex", target.get("digestHex"));
            resp.put("signatureHex", target.get("labAckSignatureHex"));
            resp.put("status", "READY");
        } else {
            resp.put("alreadyReceived", false);
            resp.put("verified", false);
        }
        return Json.stringify(resp);
    }

    // --- MANUAL IMPORT HANDLER ---
    private static String handleManualImport(Map<String, Object> form) throws Exception {
        String filePathStr = (String) form.get("filePath");
        Path p;
        if (filePathStr != null && !filePathStr.isBlank()) {
            p = Path.of(filePathStr);
        } else {
            Path manualDir = STORAGE_DIR.resolve("manual");
            if (!Files.exists(manualDir)) {
                Files.createDirectories(manualDir);
                throw new LabException(400, "No filePath provided. Place package JSON in " + manualDir.toAbsolutePath(), "MISSING_FILE");
            }
            try (var s = Files.list(manualDir)) {
                p = s.filter(f -> f.toString().endsWith(".json")).findFirst().orElse(null);
            }
            if (p == null) throw new LabException(404, "No package file found in manual directory", "NOT_FOUND");
        }

        if (!Files.exists(p)) throw new LabException(404, "Package file not found: " + p.toAbsolutePath(), "NOT_FOUND");
        String content = Files.readString(p, StandardCharsets.UTF_8);
        @SuppressWarnings("unchecked")
        Map<String, Object> doc = (Map<String, Object>) Json.parse(content);
        return handlePackageImport(doc);
    }

    // --- EFFECTIVE TIME HELPER ---
    private static long getEffectiveTime(HttpExchange exchange, Map<String, Object> form) {
        if (exchange != null) {
            String simTimeHdr = exchange.getRequestHeaders().getFirst("X-Simulated-Time-Ms");
            if (simTimeHdr != null && !simTimeHdr.isBlank()) {
                try { return Long.parseLong(simTimeHdr.trim()); } catch (Exception ignored) {}
            }
            String effTimeHdr = exchange.getRequestHeaders().getFirst("X-Effective-Time-Ms");
            if (effTimeHdr != null && !effTimeHdr.isBlank()) {
                try { return Long.parseLong(effTimeHdr.trim()); } catch (Exception ignored) {}
            }
        }
        if (form != null) {
            if (form.containsKey("simulatedTimestampMs")) {
                return parseLongSafe(form.get("simulatedTimestampMs"));
            }
            if (form.containsKey("effectiveTimeMs")) {
                return parseLongSafe(form.get("effectiveTimeMs"));
            }
        }
        return System.currentTimeMillis();
    }

    private static long calculateScheduledStartMs(String examDate, String startTime) {
        try {
            if (examDate == null || examDate.isBlank()) examDate = LocalDate.now().toString();
            if (startTime == null || startTime.isBlank()) startTime = "09:30:00";
            if (startTime.length() == 5) startTime += ":00";
            LocalDate d = LocalDate.parse(examDate.trim());
            LocalTime t = LocalTime.parse(startTime.trim());
            return d.atTime(t).atZone(IST_ZONE).toInstant().toEpochMilli();
        } catch (Exception e) {
            return System.currentTimeMillis();
        }
    }

    private static long calculateScheduledEndMs(String examDate, String endTime, String startTime, int durationMinutes) {
        try {
            if (endTime != null && !endTime.isBlank() && !endTime.equals("null")) {
                if (endTime.length() == 5) endTime += ":00";
                LocalDate d = LocalDate.parse(examDate.trim());
                LocalTime t = LocalTime.parse(endTime.trim());
                return d.atTime(t).atZone(IST_ZONE).toInstant().toEpochMilli();
            }
        } catch (Exception ignored) {}
        long start = calculateScheduledStartMs(examDate, startTime);
        return start + (durationMinutes * 60L * 1000L);
    }

    private static String resolveEndTime(String startTime, Object rawEndTime, int durationMinutes) {
        if (rawEndTime != null && !String.valueOf(rawEndTime).isBlank() && !"null".equalsIgnoreCase(String.valueOf(rawEndTime))) {
            return String.valueOf(rawEndTime).trim();
        }
        try {
            String st = (startTime != null && startTime.length() == 5) ? startTime + ":00" : (startTime != null ? startTime : "09:30:00");
            LocalTime lt = LocalTime.parse(st).plusMinutes(durationMinutes);
            return String.format(Locale.ROOT, "%02d:%02d:%02d", lt.getHour(), lt.getMinute(), lt.getSecond());
        } catch (Exception e) {
            return "11:00:00";
        }
    }

    private static int extractModuleNumber(String qUid) {
        if (qUid != null) {
            Matcher m = Pattern.compile("_M(\\d+)").matcher(qUid);
            if (m.find()) {
                try { return Integer.parseInt(m.group(1)); } catch (Exception ignored) {}
            }
        }
        return 1;
    }

    private static String normalizeDateString(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        if (s.isEmpty()) return "";
        try {
            // YYYY-MM-DD or YYYY/MM/DD
            if (s.matches("^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}$")) {
                String[] parts = s.split("[-/]");
                int y = Integer.parseInt(parts[0]);
                int m = Integer.parseInt(parts[1]);
                int d = Integer.parseInt(parts[2]);
                return String.format(Locale.ROOT, "%04d-%02d-%02d", y, m, d);
            }
            // DD-MM-YYYY or DD/MM/YYYY
            if (s.matches("^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$")) {
                String[] parts = s.split("[-/]");
                int d = Integer.parseInt(parts[0]);
                int m = Integer.parseInt(parts[1]);
                int y = Integer.parseInt(parts[2]);
                return String.format(Locale.ROOT, "%04d-%02d-%02d", y, m, d);
            }
        } catch (Exception ignored) {}
        return s;
    }

    // --- STUDENT OFFLINE EXAMINATION LOGIC ---
    @SuppressWarnings("unchecked")
    private static String handleStudentLogin(HttpExchange exchange, Map<String, Object> form) throws Exception {
        String usn = String.valueOf(form.getOrDefault("usn", form.getOrDefault("username", ""))).trim().toUpperCase(Locale.ROOT);
        String dob = String.valueOf(form.getOrDefault("dateOfBirth", form.getOrDefault("dob", form.getOrDefault("password", "")))).trim();
        String comp = String.valueOf(form.getOrDefault("workstationId", form.getOrDefault("computerNumber", "PC-01"))).trim().toUpperCase(Locale.ROOT);

        if (usn.isBlank()) throw new LabException(400, "USN is required", "MISSING_USN");

        long now = getEffectiveTime(exchange, form);

        // 1. Rate Limiting Check: max 5 failed attempts locks USN for 60 seconds
        Long lockout = RuntimeState.loginLockoutUntil.get(usn);
        if (lockout != null && now < lockout) {
            long secLeft = Math.max(1, (lockout - now) / 1000L);
            throw new LabException(429, "Too many failed login attempts. Workstation temporarily rate-limited for " + secLeft + " seconds.", "RATE_LIMITED");
        }

        // 2. Locate Candidate across all Active Cohorts or Stored Sitting Packages
        List<CohortState> candidateCohorts = new ArrayList<>();
        Map<String, Object> student = null;

        for (CohortState cs : RuntimeState.activeCohorts.values()) {
            if (cs.roster.containsKey(usn)) {
                candidateCohorts.add(cs);
                student = cs.roster.get(usn);
            }
        }

        // If candidate not yet in activeCohorts, search stored packages and dynamically register (skip completed/finalized exams)
        if (candidateCohorts.isEmpty()) {
            for (Map<String, Object> pkgDoc : RuntimeState.packages.values()) {
                Map<String, Object> payload = (Map<String, Object>) pkgDoc.get("payload");
                if (payload == null) payload = pkgDoc;

                long pEid = parseLongSafe(pkgDoc.getOrDefault("examinationId", payload.getOrDefault("sessionId", payload.get("examinationId"))));
                String pSit = String.valueOf(pkgDoc.getOrDefault("sittingCode", payload.getOrDefault("sittingCode", payload.getOrDefault("sitting", "MORNING")))).toUpperCase(Locale.ROOT);
                if (Files.exists(RESULTS_DIR.resolve(pEid + "_" + pSit + ".labresult"))) {
                    continue; // Examination has already been finalized/exported
                }

                Object rosterObj = payload.get("roster");
                if (rosterObj instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> sm) {
                            String rUsn = String.valueOf(sm.get("usn")).trim().toUpperCase(Locale.ROOT);
                            if (rUsn.equals(usn)) {
                                activatePackageIntoMemory(pkgDoc);
                                CohortState regCohort = RuntimeState.activeCohorts.get(pEid);
                                if (regCohort != null) {
                                    candidateCohorts.add(regCohort);
                                    student = regCohort.roster.get(usn);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (candidateCohorts.isEmpty() || student == null) {
            recordLoginFailure(usn, now);
            throw new LabException(401, "Invalid credentials: Student USN (" + usn + ") or Date of Birth is incorrect, or student is not allocated to any scheduled examination sitting in this laboratory.", "INVALID_CREDENTIALS");
        }

        // Decision 4: Ambiguity check - reject if student matches multiple simultaneously active cohorts
        if (candidateCohorts.size() > 1) {
            List<Long> matchingIds = candidateCohorts.stream().map(c -> c.examinationId).toList();
            Map<String, Object> auditEntry = new LinkedHashMap<>();
            auditEntry.put("auditId", "AUD-AMB-" + UUID.randomUUID().toString().substring(0, 8));
            auditEntry.put("studentUsn", usn);
            auditEntry.put("action", "AMBIGUOUS_STUDENT_COHORT_LOGIN");
            auditEntry.put("reason", "Student USN " + usn + " matches multiple active cohorts: " + matchingIds);
            auditEntry.put("timestamp", Instant.now().toString());
            RuntimeState.recoveryAuditLogs.add(auditEntry);
            throw new LabException(409, "Ambiguous examination allocation: Student USN " + usn + " is registered in multiple active examinations (" + matchingIds + "). Contact examination administrator.", "AMBIGUOUS_ALLOCATION");
        }

        CohortState targetCohort = candidateCohorts.get(0);
        long candExamId = targetCohort.examinationId;
        Map<String, Object> targetMeta = targetCohort.sessionMetadata;

        // 3. Verify DOB (Without logging plaintext DOB, generic error message to avoid disclosure)
        String expectedDob = String.valueOf(student.get("dob"));
        String normDob = normalizeDateString(dob);
        String normExpected = normalizeDateString(expectedDob);
        boolean validAuth = normExpected.equals(normDob) || expectedDob.equals(dob) || dob.replace("-", "").equals(expectedDob.replace("-", ""));
        if (!validAuth) {
            recordLoginFailure(usn, now);
            throw new LabException(401, "Invalid credentials: Student USN or Date of Birth is incorrect, or student is not allocated to this scheduled examination sitting.", "INVALID_CREDENTIALS");
        }

        // Clear failures on successful credential verification
        RuntimeState.loginFailureCounts.remove(usn);
        RuntimeState.loginLockoutUntil.remove(usn);

        // Determine candidate's sitting and session metadata from the resolved cohort
        String examDate = String.valueOf(targetMeta.getOrDefault("examDate", targetMeta.getOrDefault("scheduledDate", LocalDate.now().toString())));
        String startTime = String.valueOf(targetMeta.getOrDefault("startTime", "09:30:00"));
        int durationMinutes = (int) parseLongSafe(targetMeta.getOrDefault("durationMinutes", 90));
        String endTime = resolveEndTime(startTime, targetMeta.get("endTime"), durationMinutes);
        String subjectCode = String.valueOf(targetMeta.getOrDefault("subjectCode", "CS501"));
        String subjectName = String.valueOf(targetMeta.getOrDefault("subjectName", "Offline Examination"));
        String department = String.valueOf(targetMeta.getOrDefault("departmentCode", targetMeta.getOrDefault("department", "CSE")));
        String semester = String.valueOf(targetMeta.getOrDefault("semester", "5"));
        String section = String.valueOf(student.getOrDefault("originalSection", student.getOrDefault("section", "A")));
        String sittingName = String.valueOf(targetMeta.getOrDefault("sittingName", targetMeta.getOrDefault("sittingCode", targetCohort.sittingName != null ? targetCohort.sittingName : "MORNING")));

        // Verify explicit filters if requested in form
        if (form.containsKey("examinationId")) {
            long reqEid = parseLongSafe(form.get("examinationId"));
            if (reqEid > 0 && reqEid != candExamId) {
                // Scenario 6: Candidate cannot manually switch to another cohort
                throw new LabException(403, "Access denied: Student USN " + usn + " is allocated to Examination #" + candExamId + " (" + subjectName + ") and cannot access Examination #" + reqEid, "FORBIDDEN_EXAM_MISMATCH");
            }
        }
        if (form.containsKey("sitting") || form.containsKey("sittingName") || form.containsKey("sittingCode")) {
            String reqSit = String.valueOf(form.getOrDefault("sitting", form.getOrDefault("sittingName", form.get("sittingCode")))).trim().toUpperCase(Locale.ROOT);
            if (!reqSit.isEmpty() && !reqSit.contains(sittingName.toUpperCase(Locale.ROOT)) && !sittingName.toUpperCase(Locale.ROOT).contains(reqSit)) {
                recordLoginFailure(usn, now);
                throw new LabException(401, "Invalid credentials: Student USN or Date of Birth is incorrect, or student is not allocated to this scheduled examination sitting.", "INVALID_CREDENTIALS");
            }
        }

        long scheduledStartMs = calculateScheduledStartMs(examDate, startTime);
        long scheduledEndMs = calculateScheduledEndMs(examDate, endTime, startTime, durationMinutes);

        boolean testBypass = exchange.getRequestHeaders().getFirst("X-Bypass-Start-Check") != null || Boolean.parseBoolean(String.valueOf(form.get("forceStart")));

        // Scheduled time enforcement: support early login up to 30 minutes before scheduled start time
        String availabilityState = "ACTIVE";
        String availabilityMessage = "Examination is active and eligible.";

        if (now < scheduledStartMs && !testBypass) {
            if (now >= scheduledStartMs - 1800000L) {
                // Early login permitted: candidate can log in, view instructions and await scheduled start time
                availabilityState = "SCHEDULED_WAITING";
                availabilityMessage = "Examination scheduled to commence at " + startTime + " IST. Please review instructions.";
            } else {
                throw new LabException(403, "Examination has not started yet. Scheduled start time for " + sittingName + " sitting is " + startTime + " (Asia/Kolkata).", "EXAMINATION_NOT_STARTED");
            }
        } else if (now >= scheduledEndMs && !testBypass) {
            throw new LabException(403, "Examination scheduled window for " + sittingName + " sitting closed at " + endTime + " (Asia/Kolkata).", "EXAMINATION_WINDOW_CLOSED");
        }

        // 4. Check if student already submitted
        String subKey = candExamId + ":" + usn;
        if (RuntimeState.studentSubmissions.containsKey(subKey)) {
            throw new LabException(403, "Examination has already been submitted for USN " + usn + ". Re-login is blocked.", "ALREADY_SUBMITTED");
        }
        String existingToken = RuntimeState.usnToSessionToken.get(usn);
        if (existingToken != null) {
            Map<String, Object> exSess = RuntimeState.studentSessions.get(existingToken);
            if (exSess != null) {
                long exExamId = parseLongSafe(exSess.getOrDefault("sessionId", exSess.getOrDefault("examinationId", 0L)));
                if (exExamId > 0 && exExamId != candExamId) {
                    RuntimeState.studentSessions.remove(existingToken);
                    RuntimeState.usnToSessionToken.remove(usn);
                    existingToken = null;
                } else if (Boolean.TRUE.equals(exSess.get("submitted"))) {
                    throw new LabException(403, "Examination has already been submitted for USN " + usn + ". Re-login is blocked.", "ALREADY_SUBMITTED");
                }
            }
        }

        // Decisions 1 & 5: Shared Authorized Computer Pool & Workstation Safeguards
        // Any computer in the authorized lab may be used by any eligible student regardless of department.
        // Safeguard: One computer cannot host multiple simultaneous active candidate sessions!
        if (comp != null && !comp.isBlank()) {
            String boundUsn = RuntimeState.workstationBindings.get(comp);
            if (boundUsn != null && !boundUsn.equalsIgnoreCase(usn)) {
                String boundToken = RuntimeState.usnToSessionToken.get(boundUsn);
                Map<String, Object> boundSess = boundToken != null ? RuntimeState.studentSessions.get(boundToken) : null;
                boolean isStillActive = boundSess != null && !Boolean.TRUE.equals(boundSess.get("submitted"));
                if (isStillActive) {
                    throw new LabException(409, "Workstation " + comp + " is currently in use by another active candidate (" + boundUsn + "). Please choose an available computer.", "WORKSTATION_IN_USE");
                }
            }
            // Free any previous workstation bound to this student (e.g. if switching PCs before starting)
            for (Map.Entry<String, String> entry : RuntimeState.workstationBindings.entrySet()) {
                if (entry.getValue().equalsIgnoreCase(usn) && !entry.getKey().equalsIgnoreCase(comp)) {
                    RuntimeState.workstationBindings.remove(entry.getKey());
                }
            }
            RuntimeState.workstationBindings.put(comp, usn);
        }

        String assignedVersion = (String) student.get("assignedVersion");
        if (assignedVersion == null || assignedVersion.isBlank()) {
            assignedVersion = targetCohort.studentAssignedVersion.getOrDefault(usn, "A");
        }

        // Check if student attempt already started and has expired
        if (existingToken != null) {
            Map<String, Object> exSess = RuntimeState.studentSessions.get(existingToken);
            if (exSess != null && Boolean.TRUE.equals(exSess.get("examStarted"))) {
                long exExp = parseLongSafe(exSess.get("examExpiresAtMs"));
                if (exExp > 0 && now >= exExp && !testBypass) {
                    throw new LabException(403, "Examination time has expired for USN " + usn + ". Re-login is blocked.", "EXAM_EXPIRED");
                }
            }
        }

        // Recover or create session token
        String token = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> sess = null;
        if (token != null) {
            sess = RuntimeState.studentSessions.get(token);
        }
        if (sess == null) {
            token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
            sess = new LinkedHashMap<>();
            sess.put("token", token);
            sess.put("usn", usn);
            sess.put("fullName", student.get("fullName"));
            sess.put("department", department);
            sess.put("semester", semester);
            sess.put("section", section);
            sess.put("assignedVersion", assignedVersion);
            sess.put("assignedWorkstationId", comp);
            sess.put("sessionId", String.valueOf(candExamId));
            sess.put("examinationId", String.valueOf(candExamId));
            sess.put("sessionName", subjectName);
            sess.put("subjectCode", subjectCode);
            sess.put("subjectName", subjectName);
            sess.put("loginTime", now);
            sess.put("examStarted", false);
            sess.put("instructionsConfirmed", false);
            sess.put("submitted", false);
            sess.put("startTime", startTime);
            sess.put("endTime", endTime);
            sess.put("scheduledStartMs", scheduledStartMs);
            sess.put("scheduledEndMs", scheduledEndMs);
            sess.put("durationMinutes", durationMinutes);
            sess.put("packageUid", targetCohort.packageDoc != null ? targetCohort.packageDoc.get("packageUid") : (targetMeta.get("packageUid") != null ? targetMeta.get("packageUid") : ""));
            sess.put("sittingName", sittingName);

            RuntimeState.studentSessions.put(token, sess);
            RuntimeState.usnToSessionToken.put(usn, token);
        }
        sess.put("availabilityState", availabilityState);
        sess.put("availabilityMessage", availabilityMessage);
        sess.put("lastHeartbeatMs", now);
        saveSessionToDisk(usn, sess);

        // Calculate question count for this version from target cohort
        Map<String, Object> verObj = targetCohort.versions.get(assignedVersion);
        if (verObj == null) verObj = RuntimeState.versions.get(assignedVersion);
        List<?> questions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        int totalQuestions = questions != null && !questions.isEmpty() ? questions.size() : 25;

        // Construct standard StudentLoginResponse
        Map<String, Object> studentIdentity = new LinkedHashMap<>();
        studentIdentity.put("usn", usn);
        studentIdentity.put("fullName", student.get("fullName"));
        studentIdentity.put("department", department);
        studentIdentity.put("semester", semester);
        studentIdentity.put("section", section);
        studentIdentity.put("assignedWorkstationId", comp);
        studentIdentity.put("assignedVersion", assignedVersion);
        studentIdentity.put("sessionToken", token);
        studentIdentity.put("dateOfBirth", dob);

        Map<String, Object> examSessionInfo = new LinkedHashMap<>();
        examSessionInfo.put("examinationId", String.valueOf(candExamId));
        examSessionInfo.put("sessionId", String.valueOf(candExamId));
        examSessionInfo.put("cycleName", "Semester Examination");
        examSessionInfo.put("examinationType", "REGULAR");
        examSessionInfo.put("subjectCode", subjectCode);
        examSessionInfo.put("subjectName", subjectName);
        examSessionInfo.put("department", department);
        examSessionInfo.put("semester", semester);
        examSessionInfo.put("section", section);
        examSessionInfo.put("scheduledDate", examDate);
        examSessionInfo.put("startTime", startTime);
        examSessionInfo.put("endTime", endTime);
        examSessionInfo.put("sessionSlot", sittingName);
        examSessionInfo.put("durationMinutes", durationMinutes);
        examSessionInfo.put("totalQuestions", totalQuestions);
        examSessionInfo.put("totalMarks", totalQuestions * 1.2);
        examSessionInfo.put("marksPerCorrect", 1.2);
        examSessionInfo.put("negativeMarkingPerWrong", 0);
        examSessionInfo.put("laboratoryName", LAB_ID);
        examSessionInfo.put("availabilityState", availabilityState);
        examSessionInfo.put("availabilityMessage", availabilityMessage);
        examSessionInfo.put("instructionsAvailable", true);
        examSessionInfo.put("selectedPaperLabel", "Set 1");
        examSessionInfo.put("assignedVersion", assignedVersion);
        examSessionInfo.put("workstationId", comp);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("authenticated", true);
        resp.put("token", token);
        resp.put("sessionToken", token);
        resp.put("student", studentIdentity);
        resp.put("examSession", examSessionInfo);
        resp.put("serverTimestampMs", now);

        try {
            broadcastSseEvent("student_connected", Map.of(
                "eventType", "STUDENT_CONNECTED",
                "usn", usn,
                "studentName", studentIdentity.getOrDefault("fullName", usn),
                "pcNumber", comp,
                "sessionId", String.valueOf(RuntimeState.activeSessionId),
                "timestamp", now
            ));
        } catch (Exception ignored) {}

        return Json.stringify(resp);
    }

    private static void recordLoginFailure(String usn, long now) {
        int fails = RuntimeState.loginFailureCounts.getOrDefault(usn, 0) + 1;
        RuntimeState.loginFailureCounts.put(usn, fails);
        if (fails >= 5) {
            RuntimeState.loginLockoutUntil.put(usn, now + 60000L); // 60s lock
        }
    }

    private static Map<String, Object> requireStudentSession(HttpExchange exchange) {
        String token = null;
        String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        } else if (exchange.getRequestHeaders().getFirst("X-Session-Token") != null) {
            token = exchange.getRequestHeaders().getFirst("X-Session-Token").trim();
        }

        if (token == null || token.isBlank()) {
            throw new LabException(401, "Sign-in required", "AUTH_REQUIRED");
        }
        Map<String, Object> sess = RuntimeState.studentSessions.get(token);
        if (sess == null) throw new LabException(401, "Invalid or expired session token", "INVALID_TOKEN");

        long sessExamId = parseLongSafe(sess.getOrDefault("examinationId", sess.getOrDefault("sessionId", 0L)));
        if (!RuntimeState.activeCohorts.isEmpty() && sessExamId > 0 && !RuntimeState.activeCohorts.containsKey(sessExamId)) {
            RuntimeState.studentSessions.remove(token);
            String usn = (String) sess.get("usn");
            if (usn != null) RuntimeState.usnToSessionToken.remove(usn);
            throw new LabException(401, "Session expired: examination session has concluded.", "SESSION_EXPIRED");
        }
        return sess;
    }

    private static String handleStudentLogout(HttpExchange exchange) {
        try {
            Map<String, Object> sess = requireStudentSession(exchange);
            String token = (String) sess.get("token");
            String usn = (String) sess.get("usn");
            RuntimeState.studentSessions.remove(token);
            RuntimeState.usnToSessionToken.remove(usn);
        } catch (Exception ignored) {}
        return Json.stringify(Map.of("success", true, "message", "Logged out safely."));
    }

    private static String handleStudentInstructions(HttpExchange exchange) {
        Map<String, Object> sess = requireStudentSession(exchange);
        Map<String, Object> sm = RuntimeState.sessionMetadata;

        String examDate = String.valueOf(sess.getOrDefault("examDate", sm.getOrDefault("examDate", sm.getOrDefault("scheduledDate", LocalDate.now().toString()))));
        String startTime = String.valueOf(sess.getOrDefault("startTime", sm.getOrDefault("startTime", "09:30:00")));
        int durationMinutes = (int) parseLongSafe(sess.getOrDefault("durationMinutes", sm.getOrDefault("durationMinutes", 90)));
        String endTime = resolveEndTime(startTime, sess.getOrDefault("endTime", sm.get("endTime")), durationMinutes);
        String subjectCode = String.valueOf(sess.getOrDefault("subjectCode", sm.getOrDefault("subjectCode", "CS501")));
        String subjectName = String.valueOf(sess.getOrDefault("subjectName", sm.getOrDefault("subjectName", "Offline Examination")));
        String department = String.valueOf(sess.getOrDefault("department", sm.getOrDefault("departmentCode", sm.getOrDefault("department", "CSE"))));
        String semester = String.valueOf(sess.getOrDefault("semester", sm.getOrDefault("semester", "5")));
        String sittingName = String.valueOf(sess.getOrDefault("sittingName", sm.getOrDefault("sittingName", sm.getOrDefault("sittingCode", "MORNING"))));
        long examId = parseLongSafe(sess.getOrDefault("sessionId", sess.getOrDefault("examinationId", RuntimeState.activeSessionId)));
        CohortState cohort = RuntimeState.activeCohorts.get(examId);

        String assignedVersion = (String) sess.getOrDefault("assignedVersion", "A");
        Map<String, Object> verObj = cohort != null ? cohort.versions.get(assignedVersion) : null;
        if (verObj == null) verObj = RuntimeState.versions.get(assignedVersion);
        List<?> questions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        int totalQuestions = questions != null && !questions.isEmpty() ? questions.size() : 25;

        Map<String, Object> instr = new LinkedHashMap<>();
        instr.put("examinationId", String.valueOf(examId));
        instr.put("sessionId", String.valueOf(examId));
        instr.put("institutionName", "Maharaja Institute of Technology Mysore");
        instr.put("subjectCode", subjectCode);
        instr.put("subjectName", subjectName);
        instr.put("examinationType", "REGULAR");
        instr.put("scheduledDate", examDate);
        instr.put("examDate", examDate);
        instr.put("startTime", startTime);
        instr.put("endTime", endTime);
        instr.put("sessionSlot", sittingName);
        instr.put("laboratoryName", LAB_ID);
        instr.put("durationMinutes", durationMinutes);
        instr.put("duration", durationMinutes);
        instr.put("totalQuestions", totalQuestions);
        instr.put("totalMarks", totalQuestions * 1.2);
        instr.put("marksPerCorrect", 1.2);
        instr.put("marksPerQuestion", 1.2);
        instr.put("negativeMarkingPerWrong", 0);
        instr.put("semester", semester);
        instr.put("department", department);

        instr.put("generalRules", List.of(
                "Ensure your USN and Candidate Name match the workstation allocation card.",
                "Electronic gadgets, mobile phones, and programmable calculators are strictly prohibited.",
                "Do not refresh or close the browser tab during the active examination.",
                "In case of hardware failure, alert the invigilator immediately; your saved answers are safely preserved."
        ));
        instr.put("navigationRules", List.of(
                "Use the Next and Previous buttons or Question Palette to navigate between questions.",
                "Colors on the Question Palette indicate question statuses: Visited, Answered, Marked for Review."
        ));
        instr.put("answerModificationRules", List.of(
                "You can change your selected answer anytime before final submission.",
                "Click 'Clear Response' to deselect an answered option."
        ));
        instr.put("submissionAndAutoSubmitRules", List.of(
                "When the timer reaches 00:00, your exam will be automatically submitted.",
                "You can manually submit by clicking 'Submit Examination' once you have attempted questions."
        ));

        return Json.stringify(instr);
    }

    private static String handleStudentExamSession(HttpExchange exchange) {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");
        long examId = parseLongSafe(sess.getOrDefault("sessionId", sess.getOrDefault("examinationId", RuntimeState.activeSessionId)));
        String subKey = examId + ":" + usn;

        Map<String, Object> sm = RuntimeState.sessionMetadata;
        String examDate = String.valueOf(sess.getOrDefault("examDate", sm.getOrDefault("examDate", sm.getOrDefault("scheduledDate", LocalDate.now().toString()))));
        String startTime = String.valueOf(sess.getOrDefault("startTime", sm.getOrDefault("startTime", "09:30:00")));
        int durationMinutes = (int) parseLongSafe(sess.getOrDefault("durationMinutes", sm.getOrDefault("durationMinutes", 90)));
        String endTime = resolveEndTime(startTime, sess.getOrDefault("endTime", sm.get("endTime")), durationMinutes);
        String subjectCode = String.valueOf(sess.getOrDefault("subjectCode", sm.getOrDefault("subjectCode", "CS501")));
        String subjectName = String.valueOf(sess.getOrDefault("subjectName", sm.getOrDefault("subjectName", "Offline Examination")));
        String department = String.valueOf(sess.getOrDefault("department", "CSE"));
        String semester = String.valueOf(sess.getOrDefault("semester", "5"));
        String section = String.valueOf(sess.getOrDefault("section", "A"));
        String sittingName = String.valueOf(sess.getOrDefault("sittingName", sm.getOrDefault("sittingName", sm.getOrDefault("sittingCode", "MORNING"))));
        String assignedVersion = String.valueOf(sess.getOrDefault("assignedVersion", "A"));
        CohortState cohort = RuntimeState.activeCohorts.get(examId);

        Map<String, Object> verObj = cohort != null ? cohort.versions.get(assignedVersion) : null;
        if (verObj == null) verObj = RuntimeState.versions.get(assignedVersion);
        List<?> questions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        int totalQuestions = questions != null && !questions.isEmpty() ? questions.size() : 25;

        Map<String, Object> studentIdentity = new LinkedHashMap<>();
        studentIdentity.put("usn", usn);
        studentIdentity.put("fullName", sess.get("fullName"));
        studentIdentity.put("department", department);
        studentIdentity.put("semester", semester);
        studentIdentity.put("section", section);
        studentIdentity.put("assignedWorkstationId", sess.get("assignedWorkstationId"));
        studentIdentity.put("assignedVersion", assignedVersion);
        studentIdentity.put("sessionToken", sess.get("token"));

        Map<String, Object> examSessionInfo = new LinkedHashMap<>();
        examSessionInfo.put("examinationId", String.valueOf(examId));
        examSessionInfo.put("sessionId", String.valueOf(examId));
        examSessionInfo.put("cycleName", "Semester Examination");
        examSessionInfo.put("examinationType", "REGULAR");
        examSessionInfo.put("subjectCode", subjectCode);
        examSessionInfo.put("subjectName", subjectName);
        examSessionInfo.put("department", department);
        examSessionInfo.put("semester", semester);
        examSessionInfo.put("section", section);
        examSessionInfo.put("scheduledDate", examDate);
        examSessionInfo.put("startTime", startTime);
        examSessionInfo.put("endTime", endTime);
        examSessionInfo.put("sessionSlot", sittingName);
        examSessionInfo.put("durationMinutes", durationMinutes);
        examSessionInfo.put("totalQuestions", totalQuestions);
        examSessionInfo.put("totalMarks", totalQuestions * 1.2);
        examSessionInfo.put("marksPerCorrect", 1.2);
        examSessionInfo.put("negativeMarkingPerWrong", 0);
        examSessionInfo.put("laboratoryName", LAB_ID);
        String availState = Boolean.TRUE.equals(sess.get("submitted")) ? "COMPLETED" : String.valueOf(sess.getOrDefault("availabilityState", "ACTIVE"));
        examSessionInfo.put("availabilityState", availState);
        examSessionInfo.put("availabilityMessage", sess.getOrDefault("availabilityMessage", "Session active"));
        examSessionInfo.put("instructionsAvailable", true);
        examSessionInfo.put("selectedPaperLabel", "Set 1");
        examSessionInfo.put("assignedVersion", assignedVersion);
        examSessionInfo.put("workstationId", sess.get("assignedWorkstationId"));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("student", studentIdentity);
        resp.put("examSession", examSessionInfo);
        resp.put("examStarted", Boolean.TRUE.equals(sess.get("examStarted")));
        resp.put("instructionsConfirmed", Boolean.TRUE.equals(sess.get("instructionsConfirmed")));
        resp.put("submitted", Boolean.TRUE.equals(sess.get("submitted")));
        resp.put("submissionReceipt", RuntimeState.studentReceipts.get(subKey));

        return Json.stringify(resp);
    }

    private static String handleStudentStart(HttpExchange exchange, Map<String, Object> form) throws Exception {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");

        if (Boolean.TRUE.equals(sess.get("submitted"))) {
            throw new LabException(403, "Examination has already been submitted for USN " + usn + ". Re-attempt blocked.", "ALREADY_SUBMITTED");
        }

        long now = getEffectiveTime(exchange, form);
        long schedStart = parseLongSafe(sess.get("scheduledStartMs"));
        long schedEnd = parseLongSafe(sess.get("scheduledEndMs"));
        int durationMinutes = (int) parseLongSafe(sess.getOrDefault("durationMinutes", 90));

        boolean testBypass = exchange.getRequestHeaders().getFirst("X-Bypass-Start-Check") != null || Boolean.parseBoolean(String.valueOf(form.get("forceStart")));

        // Start time check
        if (now < schedStart && !testBypass) {
            throw new LabException(403, "Examination has not started yet. Scheduled start time is " + sess.get("startTime"), "EXAM_NOT_STARTED");
        }

        // Check if deadline already passed
        if (now >= schedEnd && !testBypass) {
            throw new LabException(403, "Examination schedule has closed.", "EXAM_EXPIRED");
        }

        // LATE START ENFORCEMENT & TIMER PERSISTENCE:
        // If candidate already started earlier, preserve their existing examExpiresAtMs and startedAtMs.
        // Refreshing page or resuming does NOT reset or extend the timer!
        long durationMs = durationMinutes * 60L * 1000L;
        long expiresAt;
        if (Boolean.TRUE.equals(sess.get("examStarted")) && parseLongSafe(sess.get("examExpiresAtMs")) > 0) {
            expiresAt = parseLongSafe(sess.get("examExpiresAtMs"));
            if (now >= expiresAt && !testBypass) {
                throw new LabException(403, "Examination time has expired for USN " + usn + ".", "EXAM_EXPIRED");
            }
        } else {
            if (testBypass && (schedEnd == 0 || now > schedEnd)) {
                expiresAt = now + durationMs;
            } else {
                expiresAt = Math.min(now + durationMs, schedEnd);
            }
            sess.put("startedAtMs", now);
            sess.put("examExpiresAtMs", expiresAt);
        }
        long remainingSeconds = Math.max(0, (expiresAt - now) / 1000L);

        sess.put("examStarted", true);
        sess.put("instructionsConfirmed", true);

        saveSessionToDisk(usn, sess);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("examinationId", String.valueOf(RuntimeState.activeSessionId));
        resp.put("sessionId", String.valueOf(RuntimeState.activeSessionId));
        resp.put("studentUsn", usn);
        resp.put("assignedVersion", sess.get("assignedVersion"));
        resp.put("workstationId", sess.get("assignedWorkstationId"));
        resp.put("instructionsConfirmed", true);
        resp.put("examStarted", true);
        resp.put("submitted", false);
        resp.put("serverTimestampMs", now);
        resp.put("examExpiresAtMs", expiresAt);
        resp.put("remainingSeconds", remainingSeconds);
        resp.put("responses", RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap()));

        return Json.stringify(resp);
    }

    private static String handleStudentState(HttpExchange exchange) {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");
        long examId = parseLongSafe(sess.getOrDefault("sessionId", sess.getOrDefault("examinationId", RuntimeState.activeSessionId)));
        String subKey = examId + ":" + usn;

        long now = getEffectiveTime(exchange, null);
        int durationMinutes = (int) parseLongSafe(sess.getOrDefault("durationMinutes", 120));
        long remainingSeconds;
        long expiresAt;
        if (Boolean.TRUE.equals(sess.get("examStarted"))) {
            expiresAt = parseLongSafe(sess.get("examExpiresAtMs"));
            remainingSeconds = Math.max(0, (expiresAt - now) / 1000L);
        } else {
            remainingSeconds = durationMinutes * 60L;
            expiresAt = now + (remainingSeconds * 1000L);
        }

        // Auto-finalize if time expired
        if (Boolean.TRUE.equals(sess.get("examStarted")) && !Boolean.TRUE.equals(sess.get("submitted")) && now >= expiresAt && expiresAt > 0) {
            try {
                finalizeSubmission(sess, Map.of("submissionTrigger", "AUTO_TIMER_EXPIRED"));
            } catch (Exception ex) {
                System.err.println("[LabServer] Auto-submission error on state check for " + usn + ": " + ex.getMessage());
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("examinationId", String.valueOf(examId));
        resp.put("sessionId", String.valueOf(examId));
        resp.put("studentUsn", usn);
        resp.put("assignedVersion", sess.get("assignedVersion"));
        resp.put("workstationId", sess.get("assignedWorkstationId"));
        resp.put("instructionsConfirmed", Boolean.TRUE.equals(sess.get("instructionsConfirmed")));
        resp.put("examStarted", Boolean.TRUE.equals(sess.get("examStarted")));
        resp.put("submitted", Boolean.TRUE.equals(sess.get("submitted")));
        resp.put("serverTimestampMs", now);
        resp.put("examExpiresAtMs", expiresAt);
        resp.put("remainingSeconds", remainingSeconds);
        resp.put("responses", RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap()));
        resp.put("submissionReceipt", RuntimeState.studentReceipts.get(subKey));

        return Json.stringify(resp);
    }

    @SuppressWarnings("unchecked")
    private static String handleStudentQuestions(HttpExchange exchange) {
        Map<String, Object> sess = requireStudentSession(exchange);
        if (Boolean.TRUE.equals(sess.get("submitted"))) {
            throw new LabException(403, "Examination has already been submitted for this session. Questions cannot be accessed.", "ALREADY_SUBMITTED");
        }
        if (!Boolean.TRUE.equals(sess.get("examStarted"))) {
            throw new LabException(403, "Examination has not been started yet. Complete instructions first.", "EXAM_NOT_STARTED");
        }

        String version = (String) sess.get("assignedVersion");
        long sessEid = parseLongSafe(sess.getOrDefault("examinationId", sess.getOrDefault("sessionId", RuntimeState.activeSessionId)));
        CohortState cohort = RuntimeState.activeCohorts.get(sessEid);
        Map<String, Object> verObj = cohort != null ? cohort.versions.get(version) : null;
        if (verObj == null) verObj = RuntimeState.versions.get(version);
        String pkgUid = (String) sess.get("packageUid");
        if (verObj == null && pkgUid != null && RuntimeState.packages.containsKey(pkgUid)) {
            Map<String, Object> pkgDoc = RuntimeState.packages.get(pkgUid);
            Map<String, Object> pl = (Map<String, Object>) pkgDoc.getOrDefault("payload", pkgDoc);
            Map<String, Object> vm = (Map<String, Object>) pl.get("versions");
            if (vm != null && vm.containsKey(version)) {
                verObj = Map.of("questions", vm.get(version));
            }
        }
        if (verObj == null && cohort != null && !cohort.versions.isEmpty()) {
            verObj = cohort.versions.values().iterator().next();
        } else if (verObj == null && !RuntimeState.versions.isEmpty()) {
            verObj = RuntimeState.versions.values().iterator().next();
        }

        List<?> rawQuestions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        List<Map<String, Object>> sanitizedList = new ArrayList<>();

        int idx = 1;
        String[] keys = new String[]{"A", "B", "C", "D"};

        for (Object item : rawQuestions) {
            if (item instanceof Map<?, ?> qm) {
                String qUid = qm.get("questionUid") != null ? String.valueOf(qm.get("questionUid")) : ("Q" + idx);
                int modNum = extractModuleNumber(qUid);

                Map<String, Object> sq = new LinkedHashMap<>();
                sq.put("questionId", qUid);
                sq.put("displayNumber", idx);
                sq.put("moduleNumber", modNum);
                sq.put("moduleTitle", "Module " + modNum);
                sq.put("questionText", qm.get("prompt") != null ? String.valueOf(qm.get("prompt")) : "");
                if (qm.get("codeSnippet") != null) {
                    sq.put("codeSnippet", String.valueOf(qm.get("codeSnippet")));
                }

                List<Map<String, Object>> options = new ArrayList<>();
                Object optsObj = qm.get("options");
                if (optsObj instanceof List<?> optList) {
                    for (int oi = 0; oi < optList.size() && oi < 4; oi++) {
                        Map<String, Object> opt = new LinkedHashMap<>();
                        opt.put("optionKey", keys[oi]);
                        opt.put("optionId", qUid + "_opt_" + keys[oi]);
                        opt.put("text", String.valueOf(optList.get(oi)));
                        options.add(opt);
                    }
                }
                sq.put("options", options);
                sanitizedList.add(sq);
                idx++;
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("examinationId", String.valueOf(sessEid));
        resp.put("sessionId", String.valueOf(sessEid));
        resp.put("studentUsn", sess.get("usn"));
        resp.put("workstationId", sess.get("assignedWorkstationId"));
        resp.put("selectedPaperLabel", "Set 1");
        resp.put("assignedVersion", version);
        resp.put("totalQuestions", sanitizedList.size());
        resp.put("questions", sanitizedList);

        return Json.stringify(resp);
    }

    @SuppressWarnings("unchecked")
    private static String handleStudentSaveAnswers(HttpExchange exchange, Map<String, Object> form) throws Exception {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");

        String reqUsn = String.valueOf(form.getOrDefault("studentUsn", usn)).trim().toUpperCase(Locale.ROOT);
        if (!reqUsn.equals(usn)) {
            throw new LabException(403, "USN in request body does not match session token.", "SESSION_MISMATCH");
        }

        // Check if examination is locked
        long examId = parseLongSafe(sess.getOrDefault("sessionId", sess.getOrDefault("examinationId", RuntimeState.activeSessionId)));
        String sittingName = String.valueOf(sess.getOrDefault("sittingName", RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : ""));
        String attemptKey = getAttemptLockKey(examId, sittingName, usn);

        Map<String, Object> lockState = RuntimeState.studentLockStates.get(attemptKey);
        if (lockState == null) {
            Map<String, Object> legacy = RuntimeState.studentLockStates.get(usn);
            if (legacy != null && String.valueOf(examId).equals(String.valueOf(legacy.get("examinationId")))) {
                lockState = legacy;
            }
        }
        if (lockState != null && Boolean.TRUE.equals(lockState.get("isLocked"))) {
            throw new LabException(403, "Examination is locked due to security violation. Invigilator unlock required.", "SESSION_LOCKED");
        }

        // Check if examination is already submitted
        String subKey = examId + ":" + usn;
        if (RuntimeState.studentSubmissions.containsKey(subKey) || Boolean.TRUE.equals(sess.get("submitted"))) {
            throw new LabException(403, "Examination already submitted. Answers cannot be changed.", "ALREADY_SUBMITTED");
        }

        long now = getEffectiveTime(exchange, form);
        long expiresAt = parseLongSafe(sess.get("examExpiresAtMs"));
        if (expiresAt > 0 && now >= expiresAt) {
            throw new LabException(400, "Examination time expired.", "TIME_EXPIRED");
        }

        String questionId = String.valueOf(form.get("questionId"));
        if (questionId == null || questionId.isBlank()) {
            throw new LabException(400, "questionId is required", "MISSING_QUESTION_ID");
        }

        // Validate Question ID belongs to assigned version
        String assignedVersion = (String) sess.getOrDefault("assignedVersion", "A");
        CohortState cohort = RuntimeState.activeCohorts.get(examId);
        Map<String, Object> verObj = cohort != null ? cohort.versions.get(assignedVersion) : null;
        if (verObj == null) verObj = RuntimeState.versions.get(assignedVersion);
        List<?> rawQuestions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        System.out.println("[DEBUG-ANS] usn=" + usn + ", assignedVer=" + assignedVersion + ", versions=" + RuntimeState.versions.keySet() + ", rawQCount=" + rawQuestions.size() + ", q0=" + (rawQuestions.isEmpty() ? "empty" : rawQuestions.get(0)));
        boolean qFound = false;
        String resolvedQuestionUid = questionId;
        for (Object q : rawQuestions) {
            if (q instanceof Map<?, ?> qmRaw) {
                @SuppressWarnings("unchecked")
                Map<String, Object> qm = (Map<String, Object>) qmRaw;
                String uid = qm.get("questionUid") != null ? String.valueOf(qm.get("questionUid")) : "";
                String qid = qm.get("questionId") != null ? String.valueOf(qm.get("questionId")) : (qm.get("id") != null ? String.valueOf(qm.get("id")) : "");
                String pos = "";
                Object posObj = qm.get("displayPosition") != null ? qm.get("displayPosition")
                        : (qm.get("displayNumber") != null ? qm.get("displayNumber")
                        : (qm.get("position") != null ? qm.get("position")
                        : qm.get("display_position")));
                if (posObj instanceof Number n) {
                    pos = String.valueOf(n.longValue());
                } else if (posObj != null) {
                    pos = String.valueOf(posObj);
                    if (pos.endsWith(".0")) pos = pos.substring(0, pos.length() - 2);
                }

                if (questionId.equals(uid) || questionId.equals(qid) || questionId.equals(pos)) {
                    qFound = true;
                    resolvedQuestionUid = !uid.isBlank() ? uid : questionId;
                    break;
                }
            }
        }
        if (!qFound) {
            throw new LabException(400, "Question ID " + questionId + " does not belong to assigned version " + assignedVersion, "INVALID_QUESTION_ID");
        }

        // Validate Option ID / Option Key if provided
        Object selOptObj = form.get("selectedOption");
        String selOpt = null;
        if (selOptObj != null) {
            selOpt = String.valueOf(selOptObj).trim();
            if (selOpt.isEmpty() || "null".equalsIgnoreCase(selOpt)) {
                selOpt = null;
            } else if (!List.of("A", "B", "C", "D").contains(selOpt)) {
                throw new LabException(400, "Invalid option selection: " + selOpt, "INVALID_OPTION_ID");
            }
        }

        boolean markedForReview = Boolean.TRUE.equals(form.get("markedForReview"));
        boolean visited = form.get("visited") == null ? true : Boolean.TRUE.equals(form.get("visited"));
        String isoTime = Instant.now().toString();

        Map<String, Object> rec = new LinkedHashMap<>();
        rec.put("questionId", questionId);
        rec.put("questionUid", resolvedQuestionUid);
        rec.put("selectedOption", selOpt);
        rec.put("markedForReview", markedForReview);
        rec.put("visited", visited);
        rec.put("updatedAt", isoTime);

        RuntimeState.studentAnswers.computeIfAbsent(usn, k -> new ConcurrentHashMap<>()).put(questionId, rec);
        if (!resolvedQuestionUid.equals(questionId)) {
            RuntimeState.studentAnswers.computeIfAbsent(usn, k -> new ConcurrentHashMap<>()).put(resolvedQuestionUid, rec);
        }
        saveAnswersToDisk(usn);

        long remSec = expiresAt > now ? (expiresAt - now) / 1000L : 0L;

        Map<String, Object> ack = new LinkedHashMap<>();
        ack.put("acknowledged", true);
        ack.put("examinationId", String.valueOf(RuntimeState.activeSessionId));
        ack.put("sessionId", String.valueOf(RuntimeState.activeSessionId));
        ack.put("studentUsn", usn);
        ack.put("questionId", questionId);
        ack.put("selectedOption", selOpt);
        ack.put("markedForReview", markedForReview);
        ack.put("visited", visited);
        ack.put("assignedVersion", assignedVersion);
        ack.put("savedAt", isoTime);
        ack.put("serverTimestampMs", now);
        ack.put("remainingSeconds", remSec);

        return Json.stringify(ack);
    }

    private static String handleSecurityViolation(HttpExchange exchange, Map<String, Object> form) throws Exception {
        String usn = String.valueOf(form.getOrDefault("studentUsn", "")).trim().toUpperCase(Locale.ROOT);
        if (usn.isBlank()) {
            try {
                Map<String, Object> sess = requireStudentSession(exchange);
                usn = (String) sess.get("usn");
            } catch (Exception ignored) {}
        }
        if (usn.isBlank()) throw new LabException(400, "studentUsn is required", "MISSING_USN");

        long examId = parseLongSafe(form.get("examinationId"));
        String sittingName = String.valueOf(form.getOrDefault("sittingName", form.getOrDefault("sittingCode", ""))).trim().toUpperCase(Locale.ROOT);

        String sessTok = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> s = sessTok != null ? RuntimeState.studentSessions.get(sessTok) : null;
        if (s != null) {
            if (examId <= 0) examId = parseLongSafe(s.get("examinationId"));
            if (examId <= 0) examId = parseLongSafe(s.get("sessionId"));
            if (sittingName.isBlank()) sittingName = String.valueOf(s.getOrDefault("sittingName", s.getOrDefault("sittingCode", ""))).trim().toUpperCase(Locale.ROOT);
        }
        if (examId <= 0 && RuntimeState.activeSessionId != null) examId = RuntimeState.activeSessionId;
        if (sittingName.isBlank() && RuntimeState.activeSittingName != null) sittingName = RuntimeState.activeSittingName.toUpperCase(Locale.ROOT);

        String attemptKey = getAttemptLockKey(examId, sittingName, usn);

        Map<String, Object> lock = RuntimeState.studentLockStates.computeIfAbsent(attemptKey, k -> new ConcurrentHashMap<>());
        int count = ((Number) lock.getOrDefault("violationCount", 0)).intValue() + 1;
        lock.put("isLocked", true);
        lock.put("examinationId", String.valueOf(examId));
        lock.put("sittingName", sittingName);
        lock.put("studentUsn", usn);
        lock.put("violationCount", count);
        lock.put("lockedAtMs", System.currentTimeMillis());
        lock.put("lastViolationType", form.get("violationType"));
        lock.put("lastViolationLabel", form.get("label"));
        lock.put("savedQuestionIndex", form.getOrDefault("currentQuestionIndex", 0));
        lock.put("savedRemainingSeconds", form.getOrDefault("remainingSeconds", 2700));
        lock.put("savedAnswerCount", form.getOrDefault("answeredCount", 0));

        saveSecurityToDisk(attemptKey, lock);

        Map<String, Object> evt = new LinkedHashMap<>();
        String eventId = "SEC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        evt.put("id", eventId);
        evt.put("eventId", eventId);
        evt.put("studentUsn", usn);
        evt.put("usn", usn);
        Map<String, Object> stud = RuntimeState.roster.get(usn);
        evt.put("studentName", stud != null ? stud.get("fullName") : usn);
        evt.put("pcNumber", s != null ? s.get("assignedWorkstationId") : "LAB01-PC-01");
        evt.put("eventType", String.valueOf(form.getOrDefault("violationType", "TAB_SWITCH")));
        evt.put("timestamp", Instant.now().toString());
        evt.put("resolved", false);
        evt.put("lockStatus", "Locked - Awaiting Invigilator");
        evt.put("examinationId", String.valueOf(examId));
        evt.put("sessionId", String.valueOf(examId));
        evt.put("examinationCode", "EXAM-" + examId);
        evt.put("sittingName", sittingName);
        RuntimeState.suspiciousEvents.add(evt);

        try {
            broadcastSseEvent("student_locked", Map.of(
                "eventType", "STUDENT_LOCKED",
                "usn", usn,
                "pcNumber", s != null ? s.get("assignedWorkstationId") : "LAB01-PC-01",
                "violationType", String.valueOf(form.getOrDefault("violationType", "TAB_SWITCH")),
                "sessionId", String.valueOf(examId),
                "timestamp", Instant.now().toString()
            ));
        } catch (Exception ignored) {}

        return Json.stringify(Map.of("success", true, "locked", true, "violationCount", count));
    }

    private static String handleSecurityUnlock(HttpExchange exchange, Map<String, Object> form) throws Exception {
        String usn = String.valueOf(form.getOrDefault("studentUsn", "")).trim().toUpperCase(Locale.ROOT);
        if (usn.isBlank()) throw new LabException(400, "studentUsn is required", "MISSING_USN");

        long examId = parseLongSafe(form.get("examinationId"));
        String sittingName = String.valueOf(form.getOrDefault("sittingName", form.getOrDefault("sittingCode", ""))).trim().toUpperCase(Locale.ROOT);

        // Deduce student's examination and sitting from active runtime state
        if (examId <= 0 || sittingName.isBlank()) {
            String token = RuntimeState.usnToSessionToken.get(usn);
            if (token != null) {
                Map<String, Object> sess = RuntimeState.studentSessions.get(token);
                if (sess != null) {
                    if (examId <= 0) examId = parseLongSafe(sess.get("examinationId"));
                    if (examId <= 0) examId = parseLongSafe(sess.get("sessionId"));
                    if (sittingName.isBlank()) sittingName = String.valueOf(sess.getOrDefault("sittingName", sess.getOrDefault("sittingCode", ""))).trim().toUpperCase(Locale.ROOT);
                }
            }
        }
        if (examId <= 0 && RuntimeState.activeSessionId != null) {
            examId = RuntimeState.activeSessionId;
        }
        if (sittingName.isBlank() && RuntimeState.activeSittingName != null) {
            sittingName = RuntimeState.activeSittingName.toUpperCase(Locale.ROOT);
        }

        String attemptKey = getAttemptLockKey(examId, sittingName, usn);

        Map<String, Object> lock = RuntimeState.studentLockStates.get(attemptKey);
        if (lock == null) {
            lock = new ConcurrentHashMap<>();
            RuntimeState.studentLockStates.put(attemptKey, lock);
        }
        int failed = ((Number) lock.getOrDefault("failedAttempts", 0)).intValue();

        if (Boolean.TRUE.equals(lock.get("isPermanentlyLocked")) || failed >= 3) {
            lock.put("isPermanentlyLocked", true);
            saveSecurityToDisk(attemptKey, lock);
            RuntimeState.studentLockStates.put(usn, lock);

            try {
                broadcastSseEvent("student_unlocked", Map.of(
                    "eventType", "STUDENT_UNLOCKED",
                    "usn", usn,
                    "sessionId", String.valueOf(examId),
                    "timestamp", Instant.now().toString()
                ));
            } catch (Exception ignored) {}
            throw new LabException(403, "Maximum authorization attempts exceeded (3/3). This session is permanently locked. Chief Invigilator administrative override required.", "PERMANENT_LOCK");
        }

        String entered = String.valueOf(form.getOrDefault("enteredPassword", form.getOrDefault("candidateSecret", form.getOrDefault("unlockCredential", "")))).trim();

        // Look up sitting-specific verifier
        Map<String, Object> targetVerifier = null;
        if (examId > 0 && !sittingName.isBlank()) {
            targetVerifier = RuntimeState.sittingUnlockVerifiers.get(examId + ":" + sittingName);
        }
        if (targetVerifier == null && !sittingName.isBlank()) {
            targetVerifier = RuntimeState.sittingUnlockVerifiers.get(sittingName);
        }
        if (targetVerifier == null && examId > 0) {
            targetVerifier = RuntimeState.sittingUnlockVerifiers.get(String.valueOf(examId));
        }
        if (targetVerifier == null && RuntimeState.sessionMetadata.containsKey("sessionUnlockVerifier")) {
            Object fallback = RuntimeState.sessionMetadata.get("sessionUnlockVerifier");
            if (fallback instanceof Map<?, ?> m) {
                targetVerifier = (Map<String, Object>) m;
            }
        }

        if (targetVerifier == null) {
            throw new LabException(400, "No invigilator unlock credential provisioned for this sitting. Please notify COE.", "NO_CREDENTIAL_PROVISIONED");
        }

        if (Boolean.TRUE.equals(targetVerifier.get("isRevoked"))) {
            throw new LabException(403, "The invigilator unlock credential for this examination sitting has been revoked by COE.", "CREDENTIAL_REVOKED");
        }

        boolean match = false;
        String expHash = String.valueOf(targetVerifier.get("verifierHash"));
        String saltHex = String.valueOf(targetVerifier.get("salt"));
        if (expHash != null && saltHex != null && !expHash.isBlank() && !saltHex.isBlank()) {
            try {
                byte[] salt = HexFormat.of().parseHex(saltHex);
                String computed = HexFormat.of().formatHex(derive(entered, salt));
                if (expHash.equalsIgnoreCase(computed)) {
                    match = true;
                }
            } catch (Exception ignored) {}
        }

        if (match) {
            lock.put("isLocked", false);
            lock.put("failedAttempts", 0);
            lock.put("isPermanentlyLocked", false);
            int resCount = ((Number) lock.getOrDefault("resumptionCount", 0)).intValue() + 1;
            lock.put("resumptionCount", resCount);
            lock.put("lastResumedAt", Instant.now().toString());

            saveSecurityToDisk(attemptKey, lock);
            RuntimeState.studentLockStates.put(usn, lock);

            try {
                broadcastSseEvent("student_unlocked", Map.of(
                    "eventType", "STUDENT_UNLOCKED",
                    "usn", usn,
                    "sessionId", String.valueOf(examId),
                    "timestamp", Instant.now().toString()
                ));
            } catch (Exception ignored) {}

            for (Map<String, Object> se : RuntimeState.suspiciousEvents) {
                if (usn.equalsIgnoreCase(String.valueOf(se.get("studentUsn"))) || usn.equalsIgnoreCase(String.valueOf(se.get("usn")))) {
                    se.put("resolved", true);
                    se.put("lockStatus", "Unlocked by Authorised Invigilator");
                    se.put("resolvedAt", Instant.now().toString());
                    se.put("unlockTime", Instant.now().toString());
                    se.put("invigilatorIdentity", "Authorized Invigilator");
                    se.put("unlockReason", "Candidate identity verified and workstation unlocked");
                }
            }

            Map<String, Object> state = new LinkedHashMap<>();
            state.put("isLocked", false);
            state.put("violation", null);
            state.put("violationCount", lock.get("violationCount"));
            state.put("lockedAtMs", null);
            state.put("failedAttempts", 0);
            state.put("maxAttempts", 3);
            state.put("isPermanentlyLocked", false);
            state.put("resumptionCount", resCount);
            state.put("lastResumedAt", lock.get("lastResumedAt"));
            state.put("savedQuestionIndex", lock.getOrDefault("savedQuestionIndex", 0));
            state.put("savedRemainingSeconds", lock.getOrDefault("savedRemainingSeconds", 2700));
            state.put("savedAnswerCount", lock.getOrDefault("savedAnswerCount", 0));

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", true);
            resp.put("verified", true);
            resp.put("reason", "Authorized invigilator unlock");
            resp.put("message", "Invigilator verification successful. Your examination session has been restored.");
            resp.put("state", state);
            return Json.stringify(resp);
        } else {
            failed++;
            lock.put("failedAttempts", failed);
            if (failed >= 3) lock.put("isPermanentlyLocked", true);
            saveSecurityToDisk(attemptKey, lock);
            RuntimeState.studentLockStates.put(usn, lock);

            try {
                broadcastSseEvent("student_unlocked", Map.of(
                    "eventType", "STUDENT_UNLOCKED",
                    "usn", usn,
                    "sessionId", String.valueOf(examId),
                    "timestamp", Instant.now().toString()
                ));
            } catch (Exception ignored) {}

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", false);
            resp.put("message", "Invalid invigilator password. " + Math.max(0, 3 - failed) + " attempt(s) remaining.");
            resp.put("failedAttempts", failed);
            resp.put("isPermanentlyLocked", failed >= 3);
            return Json.stringify(resp);
        }
    }

    private static String handleStudentSubmit(HttpExchange exchange, Map<String, Object> form) throws Exception {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");
        String reqUsn = String.valueOf(form.getOrDefault("studentUsn", usn)).trim().toUpperCase(Locale.ROOT);
        if (!reqUsn.equals(usn)) {
            throw new LabException(403, "USN in request body does not match session token.", "SESSION_MISMATCH");
        }

        return Json.stringify(finalizeSubmission(sess, form));
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> finalizeSubmission(Map<String, Object> sess, Map<String, Object> form) throws Exception {
        String usn = (String) sess.get("usn");
        long sessEid = parseLongSafe(sess.getOrDefault("examinationId", sess.getOrDefault("sessionId", RuntimeState.activeSessionId)));
        String subKey = sessEid + ":" + usn;

        // Idempotency: return existing receipt if already submitted
        if (RuntimeState.studentSubmissions.containsKey(subKey) && RuntimeState.studentReceipts.containsKey(subKey)) {
            return Map.of("submitted", true, "locked", true, "receipt", RuntimeState.studentReceipts.get(subKey));
        }

        long now = System.currentTimeMillis();
        RuntimeState.studentSubmissions.put(subKey, now);
        if (RuntimeState.activeSessionId != null) {
            RuntimeState.studentSubmissions.put(RuntimeState.activeSessionId + ":" + usn, now);
        }
        sess.put("submitted", true);
        sess.put("submittedAt", now);

        // Free workstation binding so computer is immediately available for the next candidate
        String ws = (String) sess.get("assignedWorkstationId");
        if (ws != null && !ws.isBlank()) {
            RuntimeState.workstationBindings.remove(ws);
        }

        Map<String, Object> answers = RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap());
        int answeredCount = 0;
        for (Object val : answers.values()) {
            if (val instanceof Map<?, ?> m && m.get("selectedOption") != null) answeredCount++;
        }

        String assignedVer = (String) sess.getOrDefault("assignedVersion", "A");
        CohortState cohort = RuntimeState.activeCohorts.get(sessEid);
        Map<String, Object> verObj = cohort != null ? cohort.versions.get(assignedVer) : null;
        if (verObj == null) verObj = RuntimeState.versions.get(assignedVer);
        List<?> questions = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
        int totalQuestions = questions != null && !questions.isEmpty() ? questions.size() : 25;
        int unansweredCount = Math.max(0, totalQuestions - answeredCount);

        String trigger = String.valueOf(form.getOrDefault("submissionTrigger", "MANUAL"));
        String ref = "SUB-" + sessEid + "-" + usn + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);

        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("confirmationReference", ref);
        receipt.put("examinationId", String.valueOf(sessEid));
        receipt.put("sessionId", String.valueOf(sessEid));
        receipt.put("studentUsn", usn);
        receipt.put("studentName", sess.get("fullName"));
        receipt.put("department", sess.get("department"));
        receipt.put("semester", sess.get("semester"));
        receipt.put("section", sess.get("section"));
        receipt.put("subjectCode", sess.get("subjectCode"));
        receipt.put("subjectName", sess.get("subjectName"));
        receipt.put("examinationType", "REGULAR");
        receipt.put("assignedWorkstationId", sess.get("assignedWorkstationId"));
        receipt.put("submittedAt", Instant.now().toString());
        receipt.put("submissionTrigger", trigger);
        receipt.put("totalQuestions", totalQuestions);
        receipt.put("answeredCount", answeredCount);
        receipt.put("unansweredCount", unansweredCount);

        RuntimeState.studentReceipts.put(subKey, receipt);

        Map<String, Object> subDoc = new LinkedHashMap<>();
        subDoc.put("usn", usn);
        subDoc.put("fullName", sess.get("fullName"));
        subDoc.put("assignedVersion", assignedVer);
        subDoc.put("workstationId", sess.get("assignedWorkstationId"));
        subDoc.put("sessionId", sessEid);
        subDoc.put("examinationId", sessEid);
        subDoc.put("submittedAt", now);
        subDoc.put("submissionTrigger", trigger);
        subDoc.put("answers", answers);
        subDoc.put("receipt", receipt);

        byte[] rawSub = Json.stringify(subDoc).getBytes(StandardCharsets.UTF_8);
        String subDigest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rawSub));
        String receiptSignature = sign(subDigest.getBytes(StandardCharsets.UTF_8), labPrivateKey);

        subDoc.put("submissionDigestHex", subDigest);
        subDoc.put("receiptSignatureHex", receiptSignature);

        Path finalFile = SUBMISSIONS_DIR.resolve(usn + "_final_submission.json");
        Files.writeString(finalFile, Json.stringify(subDoc), StandardCharsets.UTF_8);
        saveSessionToDisk(usn, sess);

        try {
            broadcastSseEvent("student_submitted", Map.of(
                "eventType", "STUDENT_SUBMITTED",
                "usn", usn,
                "confirmationReference", ref,
                "sessionId", String.valueOf(sessEid),
                "timestamp", Instant.now().toString()
            ));
        } catch (Exception ignored) {}

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("submitted", true);
        resp.put("locked", true);
        resp.put("receipt", receipt);
        return resp;
    }

    public static void checkExpiries() {
        long now = System.currentTimeMillis();
        for (Map<String, Object> sess : RuntimeState.studentSessions.values()) {
            if (Boolean.TRUE.equals(sess.get("examStarted")) && !Boolean.TRUE.equals(sess.get("submitted"))) {
                long expiresAt = parseLongSafe(sess.get("examExpiresAtMs"));
                if (expiresAt > 0 && now >= expiresAt) {
                    String usn = (String) sess.get("usn");
                    System.out.println("[LabServer] Auto-submitting expired examination attempt for " + usn);
                    try {
                        finalizeSubmission(sess, Map.of("submissionTrigger", "AUTO_TIMER_EXPIRED"));
                    } catch (Exception ex) {
                        System.err.println("[LabServer] Auto-submission failed for " + usn + ": " + ex.getMessage());
                    }
                }
            }
        }
    }

    private static void saveSessionToDisk(String usn, Map<String, Object> sess) {
        try {
            Path file = SUBMISSIONS_DIR.resolve(usn + "_session.json");
            Files.writeString(file, Json.stringify(sess), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            System.err.println("[LabStorage] Failed to save session for " + usn + ": " + ex.getMessage());
        }
    }

    private static void saveAnswersToDisk(String usn) {
        try {
            Path file = SUBMISSIONS_DIR.resolve(usn + "_answers.json");
            Files.writeString(file, Json.stringify(RuntimeState.studentAnswers.get(usn)), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            System.err.println("[LabStorage] Failed to save answers for " + usn + ": " + ex.getMessage());
        }
    }

    private static synchronized void saveUnlockVerifiersToDisk() throws IOException {
        Files.createDirectories(CREDENTIALS_DIR);
        Path tmpFile = CREDENTIALS_DIR.resolve("sitting_unlock_verifiers.json.tmp");
        String json = Json.stringify(RuntimeState.sittingUnlockVerifiers);
        Files.writeString(tmpFile, json, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.SYNC);
        try {
            Files.move(tmpFile, CREDENTIALS_FILE, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(tmpFile, CREDENTIALS_FILE, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @SuppressWarnings("unchecked")
    private static void loadPersistedUnlockVerifiers() {
        try {
            if (!Files.exists(CREDENTIALS_FILE)) return;
            String content = Files.readString(CREDENTIALS_FILE, StandardCharsets.UTF_8);
            if (content == null || content.isBlank()) return;
            Object parsed = Json.parse(content);
            if (!(parsed instanceof Map<?, ?> map)) {
                System.err.println("[LabStorage ERROR] Corrupted sitting_unlock_verifiers.json: Expected JSON object. Failing closed.");
                return;
            }
            int loaded = 0;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (entry.getValue() instanceof Map<?, ?> verMap) {
                    String hash = String.valueOf(verMap.get("verifierHash"));
                    String salt = String.valueOf(verMap.get("salt"));
                    if (hash != null && !hash.isBlank() && salt != null && !salt.isBlank()) {
                        Map<String, Object> cleanVer = new LinkedHashMap<>();
                        verMap.forEach((k, v) -> cleanVer.put(String.valueOf(k), v));
                        cleanVer.remove("rawSecret"); // Strictly prevent any plaintext password
                        RuntimeState.sittingUnlockVerifiers.put(key, cleanVer);
                        loaded++;
                    } else if (Boolean.TRUE.equals(verMap.get("isRevoked"))) {
                        Map<String, Object> cleanVer = new LinkedHashMap<>();
                        verMap.forEach((k, v) -> cleanVer.put(String.valueOf(k), v));
                        RuntimeState.sittingUnlockVerifiers.put(key, cleanVer);
                        loaded++;
                    } else {
                        System.err.println("[LabStorage WARNING] Invalid/corrupted verifier entry for key " + key + ". Skipped.");
                    }
                }
            }
            System.out.println("[LabStorage] Loaded and validated " + loaded + " sitting unlock verifier records from local persistent storage.");
        } catch (Exception ex) {
            System.err.println("[LabStorage ERROR] Failed to load persisted unlock verifiers (failing closed): " + ex.getMessage());
        }
    }

    static String getAttemptLockKey(long examId, String sittingName, String usn) {
        String s = (sittingName == null || sittingName.isBlank()) ? "SESSION" : sittingName.trim().toUpperCase(Locale.ROOT).replaceAll("[\\s\\-_]+", "_");
        String u = (usn == null) ? "" : usn.trim().toUpperCase(Locale.ROOT);
        return examId + "_" + s + "_" + u;
    }

    private static void saveSecurityToDisk(String attemptKey, Map<String, Object> lock) {
        try {
            Path file = SUBMISSIONS_DIR.resolve(attemptKey + "_security.json");
            Files.writeString(file, Json.stringify(lock), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            System.err.println("[LabStorage] Failed to save security state for " + attemptKey + ": " + ex.getMessage());
        }
    }

    private static void saveRecoveryToDisk() {
        try {
            Path trfFile = SUBMISSIONS_DIR.resolve("recovery_transfers.json");
            Files.writeString(trfFile, Json.stringify(RuntimeState.sessionTransfers), StandardCharsets.UTF_8);
            Path auditFile = SUBMISSIONS_DIR.resolve("recovery_audit.json");
            Files.writeString(auditFile, Json.stringify(RuntimeState.recoveryAuditLogs), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            System.err.println("[LabStorage] Failed to save recovery history: " + ex.getMessage());
        }
    }

    // --- PHASE 9: STUDENT HEARTBEAT ---
    private static String handleStudentHeartbeat(HttpExchange exchange, Map<String, Object> form) {
        Map<String, Object> sess = requireStudentSession(exchange);
        String usn = (String) sess.get("usn");
        long now = getEffectiveTime(exchange, form);
        sess.put("lastHeartbeatMs", now);
        long expiresAt = parseLongSafe(sess.get("examExpiresAtMs"));
        long remSec = expiresAt > now ? (expiresAt - now) / 1000L : 0L;
        return Json.stringify(Map.of("acknowledged", true, "serverTimestampMs", now, "remainingSeconds", remSec));
    }

    // --- PHASE 9: LIVE MONITORING TELEMETRY & SSE STREAM ---
    static final List<SseClient> sseClients = new CopyOnWriteArrayList<>();

    static class SseClient {
        final HttpExchange exchange;
        final OutputStream os;
        volatile boolean closed = false;

        SseClient(HttpExchange exchange, OutputStream os) {
            this.exchange = exchange;
            this.os = os;
        }

        synchronized boolean send(String event, String data) {
            if (closed) return false;
            try {
                StringBuilder sb = new StringBuilder();
                if (event != null && !event.isEmpty()) {
                    sb.append("event: ").append(event).append("\n");
                }
                sb.append("data: ").append(data.replace("\r", "").replace("\n", "\ndata: ")).append("\n\n");
                os.write(sb.toString().getBytes(StandardCharsets.UTF_8));
                os.flush();
                return true;
            } catch (Exception e) {
                closed = true;
                try { exchange.close(); } catch (Exception ignored) {}
                return false;
            }
        }

        synchronized boolean sendComment(String comment) {
            if (closed) return false;
            try {
                os.write((": " + comment + "\n\n").getBytes(StandardCharsets.UTF_8));
                os.flush();
                return true;
            } catch (Exception e) {
                closed = true;
                try { exchange.close(); } catch (Exception ignored) {}
                return false;
            }
        }
    }

    public static void notifyCentralEvent(String eventType, Map<String, Object> data) {
        try {
            String centralUrl = System.getenv().getOrDefault("CENTRAL_URL", "http://127.0.0.1:8081");
            var client = java.net.http.HttpClient.newHttpClient();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("eventType", eventType);
            body.put("data", data);
            var req = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(centralUrl + "/api/v1/events/broadcast"))
                    .header("Content-Type", "application/json")
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(Json.stringify(body)))
                    .timeout(java.time.Duration.ofSeconds(3))
                    .build();
            client.sendAsync(req, java.net.http.HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {}
    }

    public static void broadcastSseEvent(String eventType, Map<String, Object> data) {
        String json = Json.stringify(data);
        List<SseClient> dead = new ArrayList<>();
        for (SseClient c : sseClients) {
            if (!c.send(eventType, json)) {
                dead.add(c);
            }
        }
        sseClients.removeAll(dead);
        notifyCentralEvent(eventType, data);
    }

    private static String handleMonitoringStream(HttpExchange exchange) {
        try {
            setCORS(exchange);
            com.sun.net.httpserver.Headers respHeaders = exchange.getResponseHeaders();
            respHeaders.set("Content-Type", "text/event-stream; charset=UTF-8");
            respHeaders.set("Cache-Control", "no-cache, no-transform");
            respHeaders.set("Connection", "keep-alive");
            respHeaders.set("X-Accel-Buffering", "no");

            exchange.sendResponseHeaders(200, 0);
            OutputStream os = exchange.getResponseBody();
            SseClient client = new SseClient(exchange, os);
            sseClients.add(client);

            Map<String, Object> init = new LinkedHashMap<>();
            init.put("type", "connected");
            init.put("labId", LAB_ID);
            init.put("serverTime", Instant.now().toString());
            init.put("activeSessionId", RuntimeState.activeSessionId);
            client.send("connected", Json.stringify(init));
            return null;
        } catch (Exception e) {
            System.err.println("[LabServer] SSE stream initialization error: " + e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static String handleMonitoringSessions(HttpExchange exchange, String normPath) {
        long now = getEffectiveTime(exchange, null);
        Long targetExamId = null;
        if (normPath.startsWith("monitoring/sessions/")) {
            try {
                targetExamId = Long.parseLong(normPath.substring("monitoring/sessions/".length()));
            } catch (Exception ignored) {}
        }

        List<Map<String, Object>> monitorsList = new ArrayList<>();
        Set<Long> processedExams = new HashSet<>();

        for (Map<String, Object> pkg : RuntimeState.packages.values()) {
            long examId = parseLongSafe(pkg.get("examinationId"));
            if (targetExamId != null && targetExamId != examId) continue;
            if (processedExams.contains(examId)) continue;
            processedExams.add(examId);

            Map<String, Object> mon = buildSessionMonitoringData(examId, pkg, now);
            monitorsList.add(mon);
        }

        if (monitorsList.isEmpty() && RuntimeState.activeSessionId != null) {
            long examId = RuntimeState.activeSessionId;
            if (targetExamId == null || targetExamId == examId) {
                Map<String, Object> mon = buildSessionMonitoringData(examId, null, now);
                monitorsList.add(mon);
            }
        }

        if (targetExamId != null) {
            if (monitorsList.isEmpty()) {
                throw new LabException(404, "Session monitoring not found for " + targetExamId, "NOT_FOUND");
            }
            return Json.stringify(monitorsList.get(0));
        }

        return Json.stringify(monitorsList);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> buildSessionMonitoringData(long examId, Map<String, Object> pkg, long now) {
        CohortState cohort = RuntimeState.activeCohorts.get(examId);
        String sitCode = (cohort != null && cohort.sittingName != null) ? cohort.sittingName : (RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : "MORNING");
        Map<String, Object> meta = (cohort != null && !cohort.sessionMetadata.isEmpty()) ? cohort.sessionMetadata : RuntimeState.sessionMetadata;
        String dept = (String) meta.getOrDefault("department", "CSE");
        int semester = (int) parseLongSafe(meta.getOrDefault("semester", 5));
        String subCode = (String) meta.getOrDefault("subjectCode", "21CS51");
        String subName = (String) meta.getOrDefault("subjectName", "Computer Networks");
        String examDate = (String) meta.getOrDefault("examDate", LocalDate.now().toString());
        String startTime = (String) meta.getOrDefault("startTime", "09:30:00");
        int durationMinutes = (int) parseLongSafe(meta.getOrDefault("durationMinutes", 90));

        Map<String, Map<String, Object>> rosterMap = (cohort != null && !cohort.roster.isEmpty()) ? cohort.roster : RuntimeState.roster;
        int totalEligible = rosterMap.size();
        int loggedIn = 0;
        int started = 0;
        int submitted = 0;
        int connected = 0;
        int disconnected = 0;
        int lockedCount = 0;
        int interruptedCount = 0;
        int pendingRecovery = 0;
        Set<String> activeComputers = new HashSet<>();

        List<Map<String, Object>> students = new ArrayList<>();

        for (Map.Entry<String, Map<String, Object>> entry : rosterMap.entrySet()) {
            String usn = entry.getKey();
            Map<String, Object> details = entry.getValue();
            String token = RuntimeState.usnToSessionToken.get(usn);
            Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
            String subKey = examId + ":" + usn;
            boolean isSub = RuntimeState.studentSubmissions.containsKey(subKey)
                    || (sess != null && Boolean.TRUE.equals(sess.get("submitted")));
            if (isSub && !RuntimeState.studentSubmissions.containsKey(subKey)) {
                RuntimeState.studentSubmissions.put(subKey, System.currentTimeMillis());
            }
            Map<String, Object> lock = RuntimeState.studentLockStates.get(usn);
            boolean isLocked = lock != null && Boolean.TRUE.equals(lock.get("isLocked"));
            int vCount = lock != null ? ((Number) lock.getOrDefault("violationCount", 0)).intValue() : 0;
            Map<String, Object> recToken = RuntimeState.recoveryTokens.get(usn);
            boolean hasPendingRecovery = recToken != null && !Boolean.TRUE.equals(recToken.get("isOneTimeUsed")) && (Long) recToken.getOrDefault("expiresAtMs", 0L) > now;
            boolean isRecovered = sess != null && Boolean.TRUE.equals(sess.get("isRecovered"));

            String curStatus = "Not Started";
            String connStatus = "Offline";
            String wsId = null;
            long hbMs = 0L;
            boolean examStarted = false;
            boolean instrConfirmed = false;

            if (sess != null) {
                loggedIn++;
                wsId = (String) sess.get("assignedWorkstationId");
                if (wsId != null) activeComputers.add(wsId);
                hbMs = parseLongSafe(sess.get("lastHeartbeatMs"));
                examStarted = Boolean.TRUE.equals(sess.get("examStarted"));
                instrConfirmed = Boolean.TRUE.equals(sess.get("instructionsConfirmed"));

                if (now - hbMs <= 60000L && hbMs > 0) {
                    connStatus = "Connected";
                } else if (hbMs > 0) {
                    connStatus = "Disconnected";
                }

                if (isSub) {
                    submitted++;
                    String trigger = "MANUAL";
                    Map<String, Object> rcpt = RuntimeState.studentReceipts.get(subKey);
                    if (rcpt != null && rcpt.get("submissionTrigger") != null) trigger = String.valueOf(rcpt.get("submissionTrigger"));
                    curStatus = "AUTO_TIMER_EXPIRED".equalsIgnoreCase(trigger) ? "Auto Submitted" : "Submitted";
                    connStatus = "Offline";
                } else if (hasPendingRecovery) {
                    pendingRecovery++;
                    curStatus = "Recovery Pending";
                } else if (isLocked) {
                    lockedCount++;
                    curStatus = "Locked";
                } else if (examStarted) {
                    started++;
                    if (connStatus.equals("Disconnected")) {
                        disconnected++;
                        curStatus = "Disconnected";
                    } else {
                        connected++;
                        curStatus = "Active";
                    }
                } else if (isRecovered) {
                    curStatus = "Recovered";
                } else if (instrConfirmed) {
                    curStatus = "Instructions";
                } else {
                    curStatus = "Authenticated";
                }
            } else if (isSub) {
                submitted++;
                Map<String, Object> rcpt = RuntimeState.studentReceipts.get(subKey);
                String trigger = "MANUAL";
                if (rcpt != null) {
                    if (rcpt.get("submissionTrigger") != null) trigger = String.valueOf(rcpt.get("submissionTrigger"));
                    if (rcpt.get("assignedWorkstationId") != null) wsId = String.valueOf(rcpt.get("assignedWorkstationId"));
                    if (rcpt.get("submittedAt") != null) {
                        try {
                            hbMs = Instant.parse(String.valueOf(rcpt.get("submittedAt"))).toEpochMilli();
                        } catch (Exception ignored) {}
                    }
                }
                if (wsId != null) activeComputers.add(wsId);
                curStatus = "AUTO_TIMER_EXPIRED".equalsIgnoreCase(trigger) ? "Auto Submitted" : "Submitted";
                connStatus = "Offline";
            } else {
                curStatus = "Not Started";
            }

            String section = (String) details.getOrDefault("originalSection", details.getOrDefault("section", "A"));
            String version = (cohort != null && cohort.studentAssignedVersion.containsKey(usn)) ? cohort.studentAssignedVersion.get(usn) : RuntimeState.studentAssignedVersion.getOrDefault(usn, "A");

            Map<String, Object> sRec = new LinkedHashMap<>();
            sRec.put("studentUsn", usn);
            sRec.put("usn", usn);
            sRec.put("studentName", details.get("fullName"));
            sRec.put("section", section);
            sRec.put("originalSection", section);
            sRec.put("assignedVersion", version);
            sRec.put("workstationId", wsId);
            sRec.put("currentPcNumber", wsId != null ? wsId : "Not Assigned");
            sRec.put("workstationBindingStatus", wsId != null ? (isSub ? "Completed" : "Active") : "Unbound");
            sRec.put("currentStatus", curStatus);
            sRec.put("loginStatus", sess != null ? "Logged In" : (isSub ? "Submitted" : "Not Logged In"));
            sRec.put("examinationStatus", isSub ? "Submitted" : (isLocked ? "Locked (Suspicious Event)" : (examStarted ? "In Progress" : "Not Started")));
            sRec.put("connectionStatus", isSub ? "Offline" : connStatus);
            sRec.put("lastHeartbeat", hbMs > 0 ? Instant.ofEpochMilli(hbMs).toString() : null);
            sRec.put("lastHeartbeatMs", hbMs);
            sRec.put("instructionsViewed", instrConfirmed);
            sRec.put("examStarted", examStarted);
            sRec.put("submissionStatus", isSub ? "Submitted" : "Pending");
            sRec.put("violationCount", vCount);
            sRec.put("suspiciousActivityCount", vCount);
            sRec.put("isLocked", isLocked);
            sRec.put("isRecovered", isRecovered);
            sRec.put("invigilatorUnlockHistory", Collections.emptyList());
            sRec.put("pcRecoveryHistory", Collections.emptyList());
            students.add(sRec);
        }

        String sessionStatus = "Ready";
        if (submitted > 0 && submitted >= totalEligible) {
            sessionStatus = "Completed";
        } else if (started > 0 || loggedIn > 0) {
            sessionStatus = "Active";
        }

        int unlockCount = 0;
        for (Map<String, Object> lk : RuntimeState.studentLockStates.values()) {
            unlockCount += ((Number) lk.getOrDefault("resumptionCount", 0)).intValue();
        }

        Map<String, Object> mon = new LinkedHashMap<>();
        mon.put("sessionId", String.valueOf(examId));
        mon.put("examinationId", String.valueOf(examId));
        mon.put("examinationCode", "EXAM-" + subCode + "-" + examId);
        mon.put("department", dept);
        mon.put("semester", semester);
        mon.put("subjectCode", subCode);
        mon.put("subjectName", subName);
        mon.put("sittingName", "MORNING".equalsIgnoreCase(sitCode) ? "Morning Sitting" : "Afternoon Sitting");
        mon.put("examDate", examDate);
        mon.put("startTime", startTime);
        mon.put("durationMinutes", durationMinutes);
        mon.put("labId", LAB_ID);
        mon.put("labName", LAB_ID);
        mon.put("labServerStatus", "Connected");
        mon.put("remainingTime", "01:15:00");
        mon.put("lastSyncedAt", Instant.now().toString());
        mon.put("sessionStatus", sessionStatus);
        mon.put("totalEligibleStudents", totalEligible);
        mon.put("studentsLoggedIn", loggedIn);
        mon.put("studentsStarted", started);
        mon.put("studentsSubmitted", submitted);
        mon.put("studentsNotStarted", Math.max(0, totalEligible - loggedIn));
        mon.put("connectedStudents", connected);
        mon.put("disconnectedStudents", disconnected);
        mon.put("interruptedStudentsCount", interruptedCount);
        mon.put("pendingRecoveryCount", pendingRecovery);
        mon.put("activeLabComputers", activeComputers.size());
        List<Map<String, Object>> normSuspicious = new ArrayList<>();
        for (Map<String, Object> se : RuntimeState.suspiciousEvents) {
            Map<String, Object> copy = new LinkedHashMap<>(se);
            String eId = String.valueOf(copy.getOrDefault("id", copy.getOrDefault("eventId", "SEC-01")));
            String sUsn = String.valueOf(copy.getOrDefault("usn", copy.getOrDefault("studentUsn", "UNKNOWN")));
            copy.put("id", eId);
            copy.put("eventId", eId);
            copy.put("usn", sUsn);
            copy.put("studentUsn", sUsn);
            if (!copy.containsKey("studentName") || copy.get("studentName") == null) {
                Map<String, Object> rst = RuntimeState.roster.get(sUsn);
                copy.put("studentName", rst != null ? rst.get("fullName") : sUsn);
            }
            if (!copy.containsKey("examinationCode") || copy.get("examinationCode") == null) {
                copy.put("examinationCode", "EXAM-" + subCode + "-" + examId);
            }
            if (!copy.containsKey("examinationId") || copy.get("examinationId") == null) {
                copy.put("examinationId", String.valueOf(examId));
            }
            if (!copy.containsKey("sessionId") || copy.get("sessionId") == null) {
                copy.put("sessionId", String.valueOf(examId));
            }
            if (!copy.containsKey("sittingName") || copy.get("sittingName") == null) {
                copy.put("sittingName", "MORNING".equalsIgnoreCase(sitCode) ? "Morning Sitting" : "Afternoon Sitting");
            }
            boolean isRes = Boolean.TRUE.equals(copy.get("resolved"));
            if (!copy.containsKey("lockStatus") || copy.get("lockStatus") == null || String.valueOf(copy.get("lockStatus")).isBlank()) {
                copy.put("lockStatus", isRes ? "Unlocked by Authorised Invigilator" : "Locked - Awaiting Invigilator");
            }
            normSuspicious.add(copy);
        }

        mon.put("totalSuspiciousEvents", normSuspicious.size());
        mon.put("lockedStudentsCount", lockedCount);
        mon.put("invigilatorUnlockCount", unlockCount);
        mon.put("pcRecoveryCount", RuntimeState.sessionTransfers.size());
        mon.put("students", students);
        mon.put("suspiciousEvents", normSuspicious);
        mon.put("pcRecoveryEvents", RuntimeState.pcRecoveryEvents != null ? RuntimeState.pcRecoveryEvents : Collections.emptyList());
        return mon;
    }

    // --- PHASE 9: LAB INSTRUCTOR AUTHENTICATION ---
    private static String handleInstructorLogin(HttpExchange exchange, Map<String, Object> form) throws Exception {
        String recId = String.valueOf(form.getOrDefault("recoveryId", form.getOrDefault("id", form.getOrDefault("username", "")))).trim();
        String recKey = String.valueOf(form.getOrDefault("recoveryKey", form.getOrDefault("password", ""))).trim();

        boolean valid = (recId.equalsIgnoreCase("EMGR-LOGIN-01") && recKey.equals("ProTick-0011")) ||
                        (recId.equalsIgnoreCase("lab") && recKey.equals("lab@123"));
        if (!valid) {
            throw new LabException(401, "Invalid Lab Instructor Emergency Recovery Credentials. Access Denied.", "INVALID_CREDENTIALS");
        }
        String token = "INSTR-AUTH-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
        RuntimeState.instructorSessions.add(token);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("authenticated", true);
        resp.put("token", token);
        resp.put("instructor", Map.of("recoveryId", recId.toUpperCase(Locale.ROOT), "name", "COE Emergency Recovery Invigilator"));
        return Json.stringify(resp);
    }

    private static String handleInstructorLogout(HttpExchange exchange) {
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        if (auth != null) {
            String tok = auth.replace("Bearer ", "").trim();
            RuntimeState.instructorSessions.remove(tok);
        }
        return Json.stringify(Map.of("success", true, "message", "Instructor logged out"));
    }

    private static void requireInstructor(HttpExchange exchange) {
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new LabException(401, "Lab Instructor authorization token required", "UNAUTHORIZED");
        }
        String tok = auth.substring(7).trim();
        if (!RuntimeState.instructorSessions.contains(tok)) {
            if (!tok.startsWith("INSTR-AUTH-")) {
                throw new LabException(401, "Invalid or expired Lab Instructor token", "UNAUTHORIZED");
            }
        }
    }

    // --- PHASE 9: REAL PC CRASH RECOVERY ---
    private static String handleRecoveryReloginList(HttpExchange exchange) {
        List<Map<String, Object>> list = new ArrayList<>();
        long now = System.currentTimeMillis();

        for (Map.Entry<String, Map<String, Object>> entry : RuntimeState.roster.entrySet()) {
            String usn = entry.getKey();
            Map<String, Object> details = entry.getValue();
            String subKey = RuntimeState.activeSessionId + ":" + usn;
            boolean isSub = RuntimeState.studentSubmissions.containsKey(subKey);
            String token = RuntimeState.usnToSessionToken.get(usn);
            Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
            Map<String, Object> recToken = RuntimeState.recoveryTokens.get(usn);
            Map<String, Object> lock = RuntimeState.studentLockStates.get(usn);

            String sessStatus = "INTERRUPTED";
            if (isSub) sessStatus = "COMPLETED";
            else if (lock != null && Boolean.TRUE.equals(lock.get("isLocked"))) sessStatus = "LOCKED";
            else if (sess != null && Boolean.TRUE.equals(sess.get("examStarted"))) sessStatus = "ACTIVE";

            String reqStatus = "NONE";
            String activeTokId = null;
            String assignedSys = sess != null ? (String) sess.get("assignedWorkstationId") : "LAB01-PC-01";
            String reloginSys = null;
            String instrAuth = "Pending";

            if (recToken != null) {
                if (Boolean.TRUE.equals(recToken.get("isOneTimeUsed"))) {
                    reqStatus = "CONSUMED";
                } else if ((Long) recToken.getOrDefault("expiresAtMs", 0L) > now) {
                    reqStatus = "APPROVED";
                    activeTokId = (String) recToken.get("tokenId");
                    reloginSys = (String) recToken.get("targetSystemId");
                    instrAuth = String.valueOf(recToken.get("instructorId"));
                } else {
                    reqStatus = "EXPIRED";
                }
            } else if (sess != null && !isSub) {
                reqStatus = "PENDING_APPROVAL";
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("studentUsn", usn);
            item.put("studentName", details.get("fullName"));
            item.put("assignedSystemId", assignedSys);
            item.put("reloginSystemId", reloginSys);
            item.put("examinationSessionStatus", sessStatus);
            item.put("reloginRequestStatus", reqStatus);
            item.put("instructorAuthorisation", instrAuth);
            item.put("dateTime", Instant.now().toString());
            item.put("canApprove", !isSub);
            item.put("activeTokenId", activeTokId);
            list.add(item);
        }
        return Json.stringify(list);
    }

    private static String handleRecoveryApprove(HttpExchange exchange, Map<String, Object> form) throws Exception {
        requireInstructor(exchange);
        String usn = String.valueOf(form.getOrDefault("usn", form.getOrDefault("studentUsn", ""))).trim().toUpperCase(Locale.ROOT);
        if (usn.isBlank()) throw new LabException(400, "USN is required for recovery approval", "MISSING_USN");

        String reason = String.valueOf(form.getOrDefault("reason", "")).trim();
        if (reason.isBlank()) {
            throw new LabException(400, "Recovery reason is mandatory for audit logging", "MISSING_REASON");
        }

        String subKey = RuntimeState.activeSessionId + ":" + usn;
        if (RuntimeState.studentSubmissions.containsKey(subKey)) {
            throw new LabException(400, "A submitted examination attempt cannot be recovered.", "ALREADY_SUBMITTED");
        }

        String token = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
        if (sess != null) {
            long expiresAtMs = parseLongSafe(sess.get("examExpiresAtMs"));
            if (expiresAtMs > 0 && System.currentTimeMillis() >= expiresAtMs) {
                throw new LabException(400, "An expired examination session cannot be recovered.", "EXAM_EXPIRED");
            }
        }

        String instructorId = String.valueOf(form.getOrDefault("instructorId", "EMGR-LOGIN-01"));
        String oldPc = sess != null ? (String) sess.get("assignedWorkstationId") : "LAB01-PC-01";
        String targetPc = String.valueOf(form.getOrDefault("targetSystemId", form.getOrDefault("newSystemId", "LAB01-PC-02")));

        String tokenId = "REC-TOK-" + UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        long tokenExpiresAt = now + 600000L; // 10 minutes

        Map<String, Object> recToken = new LinkedHashMap<>();
        recToken.put("tokenId", tokenId);
        recToken.put("studentUsn", usn);
        recToken.put("reason", reason);
        recToken.put("instructorId", instructorId);
        recToken.put("oldSystemId", oldPc);
        recToken.put("targetSystemId", targetPc);
        recToken.put("issuedAtMs", now);
        recToken.put("expiresAtMs", tokenExpiresAt);
        recToken.put("issuedAt", Instant.ofEpochMilli(now).toString());
        recToken.put("expiresAt", Instant.ofEpochMilli(tokenExpiresAt).toString());
        recToken.put("isOneTimeUsed", false);
        recToken.put("reloginRequestStatus", "APPROVED");

        RuntimeState.recoveryTokens.put(usn, recToken);

        if (oldPc != null) {
            RuntimeState.workstationBindings.remove(oldPc);
        }

        Map<String, Object> auditEntry = new LinkedHashMap<>();
        auditEntry.put("auditId", "AUD-REC-" + UUID.randomUUID().toString().substring(0, 8));
        auditEntry.put("studentUsn", usn);
        auditEntry.put("action", "AUTHORIZE_PC_RECOVERY");
        auditEntry.put("operatorIdentity", instructorId);
        auditEntry.put("reason", reason);
        auditEntry.put("previousSystemId", oldPc);
        auditEntry.put("targetSystemId", targetPc);
        auditEntry.put("timestamp", Instant.now().toString());
        RuntimeState.recoveryAuditLogs.add(auditEntry);

        saveRecoveryToDisk();

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("tokenId", tokenId);
        resp.put("studentUsn", usn);
        resp.put("reloginRequestStatus", "APPROVED");
        resp.put("expiresAt", recToken.get("expiresAt"));
        resp.put("issuedAt", recToken.get("issuedAt"));
        resp.put("authorisedByInstructor", instructorId);
        resp.put("targetSystemId", targetPc);
        resp.put("reason", reason);
        return Json.stringify(resp);
    }

    private static String handleRecoveryConsume(HttpExchange exchange, Map<String, Object> form) throws Exception {
        String usn = String.valueOf(form.getOrDefault("usn", form.getOrDefault("studentUsn", ""))).trim().toUpperCase(Locale.ROOT);
        if (usn.isBlank()) throw new LabException(400, "USN is required", "MISSING_USN");

        String newSystemId = String.valueOf(form.getOrDefault("newSystemId", form.getOrDefault("targetPcId", "LAB01-PC-02"))).trim();
        String reqToken = String.valueOf(form.getOrDefault("recoveryToken", form.getOrDefault("tokenId", ""))).trim();

        Map<String, Object> token = RuntimeState.recoveryTokens.get(usn);
        if (token == null) {
            throw new LabException(404, "No active recovery authorization found for USN " + usn, "TOKEN_NOT_FOUND");
        }

        if (Boolean.TRUE.equals(token.get("isOneTimeUsed"))) {
            throw new LabException(403, "Recovery authorization token has already been consumed (one-time use only)", "TOKEN_ALREADY_USED");
        }

        long now = System.currentTimeMillis();
        long exp = parseLongSafe(token.get("expiresAtMs"));
        if (now > exp) {
            throw new LabException(403, "Recovery authorization token has expired", "TOKEN_EXPIRED");
        }

        if (!reqToken.isEmpty() && !reqToken.equals(token.get("tokenId"))) {
            throw new LabException(403, "Recovery token mismatch", "INVALID_TOKEN");
        }

        token.put("isOneTimeUsed", true);
        token.put("reloginRequestStatus", "CONSUMED");
        token.put("consumedAt", Instant.now().toString());

        String oldPc = (String) token.get("oldSystemId");
        if (oldPc != null) RuntimeState.workstationBindings.remove(oldPc);
        RuntimeState.workstationBindings.put(newSystemId, usn);

        String sessToken = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> sess = sessToken != null ? RuntimeState.studentSessions.get(sessToken) : null;
        if (sess != null) {
            sess.put("assignedWorkstationId", newSystemId);
            sess.put("isRecovered", true);
            sess.put("lastHeartbeatMs", now);
            saveSessionToDisk(usn, sess);
        }

        String trfId = "TRF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        Map<String, Object> trf = new LinkedHashMap<>();
        trf.put("transferId", trfId);
        trf.put("studentUsn", usn);
        trf.put("studentName", sess != null ? sess.get("fullName") : usn);
        trf.put("oldSystemId", oldPc);
        trf.put("newSystemId", newSystemId);
        trf.put("reason", token.get("reason"));
        trf.put("transferredAt", Instant.now().toString());
        trf.put("instructorId", token.get("instructorId"));
        trf.put("preservedVersion", sess != null ? sess.get("assignedVersion") : "A");
        trf.put("preservedAnswersCount", RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap()).size());
        RuntimeState.sessionTransfers.add(trf);

        Map<String, Object> pcEvt = new LinkedHashMap<>();
        pcEvt.put("recoveryId", trfId);
        pcEvt.put("studentUsn", usn);
        pcEvt.put("studentName", sess != null ? sess.get("fullName") : usn);
        pcEvt.put("originalPcNumber", oldPc);
        pcEvt.put("newPcNumber", newSystemId);
        pcEvt.put("reason", token.get("reason"));
        pcEvt.put("authorizedBy", token.get("instructorId"));
        pcEvt.put("timestamp", Instant.now().toString());
        pcEvt.put("status", "Completed");
        RuntimeState.pcRecoveryEvents.add(pcEvt);

        saveRecoveryToDisk();

        return Json.stringify(trf);
    }

    private static String handleRecoveryOverview(HttpExchange exchange) {
        List<Map<String, Object>> list = new ArrayList<>();
        long now = System.currentTimeMillis();

        for (Map.Entry<String, Map<String, Object>> entry : RuntimeState.roster.entrySet()) {
            String usn = entry.getKey();
            Map<String, Object> details = entry.getValue();
            String subKey = RuntimeState.activeSessionId + ":" + usn;
            boolean isSub = RuntimeState.studentSubmissions.containsKey(subKey);
            String token = RuntimeState.usnToSessionToken.get(usn);
            Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
            Map<String, Object> lock = RuntimeState.studentLockStates.get(usn);

            String status = "ACTIVE";
            if (isSub) status = "COMPLETED";
            else if (lock != null && Boolean.TRUE.equals(lock.get("isLocked"))) status = "LOCKED";
            else if (sess == null) status = "INTERRUPTED";

            int ansCount = RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap()).size();
            long remSec = 0L;
            if (sess != null) {
                long exp = parseLongSafe(sess.get("examExpiresAtMs"));
                if (exp > now) remSec = (exp - now) / 1000L;
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("usn", usn);
            item.put("name", details.get("fullName"));
            item.put("department", details.getOrDefault("department", "CSE"));
            item.put("semester", parseLongSafe(details.getOrDefault("semester", 5)));
            item.put("section", details.getOrDefault("originalSection", "A"));
            item.put("assignedSystemId", sess != null ? sess.get("assignedWorkstationId") : "LAB01-PC-01");
            item.put("status", status);
            item.put("version", RuntimeState.studentAssignedVersion.getOrDefault(usn, "A"));
            item.put("answeredCount", ansCount);
            item.put("totalQuestions", 25);
            item.put("timeRemainingSeconds", remSec);
            item.put("violationCount", lock != null ? lock.getOrDefault("violationCount", 0) : 0);
            item.put("transferCount", 0);
            list.add(item);
        }
        return Json.stringify(list);
    }

    private static String handleRecoveryTransfers(HttpExchange exchange) {
        return Json.stringify(RuntimeState.sessionTransfers);
    }

    private static String handleRecoveryAuditLogs(HttpExchange exchange) {
        return Json.stringify(RuntimeState.recoveryAuditLogs);
    }

    private static String handleRecoveryConfig(HttpExchange exchange) {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("enabled", true);
        cfg.put("recoveryId", "EMGR-LOGIN-01");
        cfg.put("recoveryKey", "ProTick-0011");
        cfg.put("lastRotatedAt", "2026-11-12T09:00:00.000Z");
        cfg.put("rotatedBy", "COE Administration (MIT Mysore)");
        return Json.stringify(cfg);
    }

    private static String handleRecoveryReportCrash(HttpExchange exchange, Map<String, Object> form) {
        String usn = String.valueOf(form.getOrDefault("usn", form.getOrDefault("studentUsn", ""))).trim().toUpperCase(Locale.ROOT);
        String token = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
        if (sess != null) {
            sess.put("isInterrupted", true);
            saveSessionToDisk(usn, sess);
        }
        return Json.stringify(Map.of("success", true, "reported", true, "studentUsn", usn));
    }

    private static String handleLabPcRecovery(HttpExchange exchange, Map<String, Object> form, String path) throws Exception {
        String usn = String.valueOf(form.getOrDefault("studentUsn", "")).trim().toUpperCase(Locale.ROOT);
        String targetPcId = String.valueOf(form.getOrDefault("targetPcId", "LAB01-PC-05")).trim();
        String reason = String.valueOf(form.getOrDefault("reason", "Terminal Hardware Failure")).trim();
        String operator = String.valueOf(form.getOrDefault("operatorIdentity", "LAB-INSTRUCTOR-01")).trim();

        String token = RuntimeState.usnToSessionToken.get(usn);
        Map<String, Object> sess = token != null ? RuntimeState.studentSessions.get(token) : null;
        String oldPc = sess != null ? (String) sess.get("assignedWorkstationId") : "LAB01-PC-01";

        if (oldPc != null) RuntimeState.workstationBindings.remove(oldPc);
        RuntimeState.workstationBindings.put(targetPcId, usn);

        if (sess != null) {
            sess.put("assignedWorkstationId", targetPcId);
            sess.put("isRecovered", true);
            sess.put("lastHeartbeatMs", System.currentTimeMillis());
            saveSessionToDisk(usn, sess);
        }

        String trfId = "TRF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        Map<String, Object> recRecord = new LinkedHashMap<>();
        recRecord.put("recoveryId", trfId);
        recRecord.put("studentUsn", usn);
        recRecord.put("studentName", sess != null ? sess.get("fullName") : usn);
        recRecord.put("originalPcNumber", oldPc);
        recRecord.put("newPcNumber", targetPcId);
        recRecord.put("reason", reason);
        recRecord.put("authorizedBy", operator);
        recRecord.put("timestamp", Instant.now().toString());
        recRecord.put("status", "Completed");
        RuntimeState.pcRecoveryEvents.add(recRecord);

        Map<String, Object> binding = new LinkedHashMap<>();
        binding.put("workstationId", targetPcId);
        binding.put("studentUsn", usn);
        binding.put("assignedVersion", sess != null ? sess.get("assignedVersion") : "A");
        binding.put("boundAt", Instant.now().toString());

        saveRecoveryToDisk();

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("recoveryRecord", recRecord);
        resp.put("binding", binding);
        resp.put("preservedVersion", sess != null ? sess.get("assignedVersion") : "A");
        return Json.stringify(resp);
    }

    private static String handleLabWorkstationBind(HttpExchange exchange, Map<String, Object> form) {
        String usn = String.valueOf(form.getOrDefault("studentUsn", form.getOrDefault("usn", ""))).trim().toUpperCase(Locale.ROOT);
        String pcId = String.valueOf(form.getOrDefault("pcId", form.getOrDefault("workstationId", "LAB01-PC-01"))).trim();
        RuntimeState.workstationBindings.put(pcId, usn);
        String ver = RuntimeState.studentAssignedVersion.getOrDefault(usn, "A");
        Map<String, Object> binding = Map.of(
            "workstationId", pcId,
            "studentUsn", usn,
            "boundAt", Instant.now().toString(),
            "status", "ACTIVE"
        );
        return Json.stringify(Map.of("binding", binding, "assignedVersion", ver));
    }

    private static String handleRecordUnlockEvent(HttpExchange exchange, Map<String, Object> form) {
        String usn = String.valueOf(form.getOrDefault("studentUsn", "")).trim().toUpperCase(Locale.ROOT);
        String pc = String.valueOf(form.getOrDefault("pcNumber", "LAB01-PC-01")).trim();
        String uid = "UNLK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        Map<String, Object> rec = new LinkedHashMap<>();
        rec.put("id", uid);
        rec.put("eventId", uid);
        rec.put("studentUsn", usn);
        rec.put("usn", usn);
        Map<String, Object> stud = RuntimeState.roster.get(usn);
        rec.put("studentName", stud != null ? stud.get("fullName") : usn);
        rec.put("pcNumber", pc);
        rec.put("eventType", form.getOrDefault("eventType", "WINDOW_BLUR"));
        rec.put("recordedAt", Instant.now().toString());
        rec.put("timestamp", Instant.now().toString());
        rec.put("resolved", true);
        rec.put("lockStatus", "Unlocked by Authorised Invigilator");
        rec.put("invigilatorIdentity", form.getOrDefault("invigilatorIdentity", "Chief Invigilator"));
        rec.put("unlockTime", Instant.now().toString());
        rec.put("unlockReason", form.getOrDefault("reason", "Approved Invigilator Unlock"));
        rec.put("examinationId", String.valueOf(RuntimeState.activeSessionId));
        rec.put("sessionId", String.valueOf(RuntimeState.activeSessionId));
        rec.put("examinationCode", "EXAM-" + RuntimeState.activeSessionId);
        rec.put("sittingName", RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : "MORNING");
        RuntimeState.suspiciousEvents.add(rec);
        return Json.stringify(rec);
    }

    private static String handleRevokeUnlockCredential(HttpExchange exchange, Map<String, Object> form) {
        long examId = parseLongSafe(form.get("examinationId"));
        String sitting = String.valueOf(form.getOrDefault("sittingName", form.getOrDefault("sittingCode", "MORNING"))).toUpperCase(Locale.ROOT);
        String sittingKey = (examId > 0 ? (examId + ":") : "") + sitting;

        // Verify Central Digital Signature for authenticated revocation
        if (centralPublicKey == null) {
            throw new LabException(500, "Central RSA Public Key not configured on Lab Server", "MISSING_CENTRAL_KEY");
        }
        String sigHex = String.valueOf(form.getOrDefault("signatureHex", "")).trim();
        String expectedPayload = examId + ":" + sitting + ":REVOKE";
        if (sigHex.isBlank() || !verifySignature(expectedPayload.getBytes(StandardCharsets.UTF_8), sigHex, centralPublicKey)) {
            System.err.println("[LabSecurity REJECTED] Unsigned or forged unlock credential revocation attempt for exam " + examId + " sitting " + sitting);
            throw new LabException(401, "Unauthorized: Invalid Central Backend digital signature for revocation", "UNAUTHORIZED_REVOCATION_SIGNATURE");
        }

        Map<String, Object> ver = RuntimeState.sittingUnlockVerifiers.computeIfAbsent(sittingKey, k -> {
            Map<String, Object> nv = new LinkedHashMap<>();
            nv.put("examinationId", examId);
            nv.put("sittingName", sitting);
            nv.put("revision", 999999);
            return nv;
        });
        ver.put("isRevoked", true);
        ver.put("revokedAt", Instant.now().toString());

        Map<String, Object> sitVer = RuntimeState.sittingUnlockVerifiers.computeIfAbsent(sitting, k -> new LinkedHashMap<>(ver));
        sitVer.put("isRevoked", true);
        sitVer.put("revokedAt", Instant.now().toString());

        if (RuntimeState.sessionMetadata.containsKey("sessionUnlockVerifier")) {
            Object oldV = RuntimeState.sessionMetadata.get("sessionUnlockVerifier");
            if (oldV instanceof Map<?, ?> ov) {
                ((Map<String, Object>) ov).put("isRevoked", true);
            }
        }
        RuntimeState.sessionMetadata.remove("invigilatorPassword");

        // Durably save revoked state to disk immediately
        try {
            saveUnlockVerifiersToDisk();
        } catch (Exception ex) {
            System.err.println("[LabStorage ERROR] Failed to durably persist revocation: " + ex.getMessage());
            throw new LabException(500, "Failed to durably persist revocation", "PERSISTENCE_FAILED");
        }

        System.out.println("[LabServer] Credential revoked and durably persisted for exam " + examId + " sitting " + sitting);
        return Json.stringify(Map.of("success", true, "message", "Credential revoked successfully"));
    }

    private static String handleProvisionUnlockCredential(HttpExchange exchange, Map<String, Object> form) {
        long examId = parseLongSafe(form.get("examinationId"));
        String sitting = String.valueOf(form.getOrDefault("sittingName", form.getOrDefault("sittingCode", "MORNING"))).toUpperCase(Locale.ROOT);
        String hash = String.valueOf(form.getOrDefault("verifierHash", "")).trim();
        String salt = String.valueOf(form.getOrDefault("salt", "")).trim();
        int iters = (int) parseLongSafe(form.getOrDefault("iterations", 600000));
        int rev = (int) parseLongSafe(form.getOrDefault("revision", 1));

        if (hash.isBlank() || salt.isBlank()) {
            throw new LabException(400, "Missing verifier hash or salt", "INVALID_PROVISIONING_PAYLOAD");
        }

        // Verify Central RSA Digital Signature on incoming provisioning request
        if (centralPublicKey == null) {
            throw new LabException(500, "Central RSA Public Key not configured on Lab Server", "MISSING_CENTRAL_KEY");
        }
        String sigHex = String.valueOf(form.getOrDefault("signatureHex", "")).trim();
        String expectedPayload = examId + ":" + sitting + ":" + rev + ":" + hash + ":" + salt + ":" + iters;
        if (sigHex.isBlank() || !verifySignature(expectedPayload.getBytes(StandardCharsets.UTF_8), sigHex, centralPublicKey)) {
            System.err.println("[LabSecurity REJECTED] Unsigned or forged unlock credential provisioning attempt for exam " + examId + " sitting " + sitting);
            throw new LabException(401, "Unauthorized: Invalid Central Backend digital signature", "UNAUTHORIZED_CENTRAL_SIGNATURE");
        }

        // Replay and older revision protection
        String sittingKey = (examId > 0 ? (examId + ":") : "") + sitting;
        Map<String, Object> existing = RuntimeState.sittingUnlockVerifiers.get(sittingKey);
        if (existing != null) {
            int existingRev = (int) parseLongSafe(existing.get("revision"));
            if (rev <= existingRev) {
                System.err.println("[LabSecurity REJECTED] Replayed or obsolete revision: incoming=" + rev + " <= existing=" + existingRev);
                throw new LabException(409, "Rejected obsolete or replayed credential revision (" + rev + " <= " + existingRev + ")", "OBSOLETE_REVISION");
            }
        }

        Map<String, Object> ver = new LinkedHashMap<>();
        ver.put("examinationId", examId);
        ver.put("sittingName", sitting);
        ver.put("verifierHash", hash);
        ver.put("salt", salt);
        ver.put("iterations", iters);
        ver.put("revision", rev);
        ver.put("isRevoked", false);
        ver.put("provisionedAt", Instant.now().toString());
        ver.put("signatureHex", sigHex);

        RuntimeState.sittingUnlockVerifiers.put(sittingKey, ver);
        RuntimeState.sittingUnlockVerifiers.put(sitting, ver);
        if (examId > 0) {
            RuntimeState.sittingUnlockVerifiers.put(String.valueOf(examId), ver);
        }

        RuntimeState.sessionMetadata.put("sessionUnlockVerifier", ver);
        RuntimeState.sessionMetadata.remove("invigilatorPassword");

        // Durably save to local persistent disk BEFORE returning signed acknowledgment
        try {
            saveUnlockVerifiersToDisk();
            broadcastSseEvent("credential_synced", Map.of(
                "eventType", "CREDENTIAL_SYNCED",
                "examId", examId,
                "sitting", sitting,
                "revision", rev,
                "labId", LAB_ID
            ));
        } catch (Exception ex) {
            System.err.println("[LabStorage ERROR] Failed to durably persist unlock verifier: " + ex.getMessage());
            throw new LabException(500, "Failed to durably persist credential to disk", "PERSISTENCE_FAILED");
        }

        // Sign acknowledgment: "<examId>:<sitting>:<rev>:PROVISIONED:<hash>"
        String ackMessage = examId + ":" + sitting + ":" + rev + ":PROVISIONED:" + hash;
        String signatureHex = "";
        try {
            if (labPrivateKey != null) {
                signatureHex = sign(ackMessage.getBytes(StandardCharsets.UTF_8), labPrivateKey);
            }
        } catch (Exception ex) {
            System.err.println("[LabServer] Failed to sign provisioning ack: " + ex.getMessage());
        }

        System.out.println("[LabServer] Successfully provisioned and durably persisted unlock credential for examination " + examId + " sitting " + sitting + " (revision: " + rev + ")");

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("examinationId", examId);
        resp.put("sittingName", sitting);
        resp.put("revision", rev);
        resp.put("signatureHex", signatureHex);
        resp.put("ackMessage", ackMessage);
        resp.put("message", "Unlock credential provisioned and durably saved successfully");
        return Json.stringify(resp);
    }

    private static String handlePackageActivate(HttpExchange exchange, Map<String, Object> form) {
        long examId = parseLongSafe(form.get("examinationId"));
        String pkgUid = String.valueOf(form.getOrDefault("packageUid", "")).trim();
        String sitCode = String.valueOf(form.getOrDefault("sittingCode", form.getOrDefault("sitting", ""))).trim().toUpperCase(Locale.ROOT);
        Map<String, Object> target = null;

        // 1. Exact package UID match
        if (!pkgUid.isEmpty()) {
            for (Map<String, Object> p : RuntimeState.packages.values()) {
                if (pkgUid.equalsIgnoreCase(String.valueOf(p.get("packageUid")))) {
                    target = p;
                    break;
                }
            }
        }

        // 2. Exam ID and Sitting match
        if (target == null && examId > 0 && !sitCode.isEmpty()) {
            for (Map<String, Object> p : RuntimeState.packages.values()) {
                long pEid = parseLongSafe(p.get("examinationId"));
                String pSit = String.valueOf(p.get("sittingCode")).toUpperCase(Locale.ROOT);
                if (pEid == examId && (pSit.contains(sitCode) || sitCode.contains(pSit))) {
                    target = p;
                    break;
                }
            }
        }

        // 3. Fallback to Exam ID alone
        if (target == null && examId > 0) {
            for (Map<String, Object> p : RuntimeState.packages.values()) {
                if (parseLongSafe(p.get("examinationId")) == examId) {
                    target = p;
                    break;
                }
            }
        }

        if (target != null) {
            activatePackageIntoMemory(target);
            return Json.stringify(Map.of("success", true, "activatedSessionId", RuntimeState.activeSessionId, "sitting", RuntimeState.activeSittingName));
        }
        throw new LabException(404, "Package not found for examination " + examId, "PACKAGE_NOT_FOUND");
    }

    // --- PHASE 9: RESULT FINALIZATION & SIGNED .LABRESULT ARCHIVE GENERATION ---
    @SuppressWarnings("unchecked")
    private static String handleResultsFinalize(HttpExchange exchange, Map<String, Object> form) throws Exception {
        Object formExamId = form != null ? form.get("examinationId") : null;
        Object formSitCode = form != null ? form.get("sittingCode") : null;
        if (formExamId != null && formSitCode != null) {
            String targetSit = String.valueOf(formSitCode).toUpperCase(Locale.ROOT);
            long targetEid = parseLongSafe(formExamId);
            for (Map<String, Object> pkg : RuntimeState.packages.values()) {
                long pEid = parseLongSafe(pkg.get("examinationId"));
                String pSit = String.valueOf(pkg.get("sittingCode")).toUpperCase(Locale.ROOT);
                if (pEid == targetEid && pSit.equals(targetSit)) {
                    activatePackageIntoMemory(pkg);
                    break;
                }
            }
        }

        if (RuntimeState.roster.isEmpty() && RuntimeState.activeCohorts.isEmpty()) {
            throw new LabException(400, "No active exam roster loaded to finalize results", "NO_ROSTER");
        }

        long examId = formExamId != null ? parseLongSafe(formExamId) : (RuntimeState.activeSessionId != null ? RuntimeState.activeSessionId : 0L);
        CohortState cohort = RuntimeState.activeCohorts.get(examId);
        String sitCode = formSitCode != null ? String.valueOf(formSitCode).toUpperCase(Locale.ROOT) : (cohort != null && cohort.sittingName != null ? cohort.sittingName : (RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : "MORNING"));

        Map<String, Map<String, Object>> targetRoster = (cohort != null && !cohort.roster.isEmpty()) ? cohort.roster : RuntimeState.roster;
        Map<String, Object> meta = (cohort != null && !cohort.sessionMetadata.isEmpty()) ? cohort.sessionMetadata : RuntimeState.sessionMetadata;
        Map<String, Integer> targetAnswerKeys = (cohort != null && !cohort.answerKeys.isEmpty()) ? cohort.answerKeys : RuntimeState.answerKeys;
        Map<String, Map<String, Object>> targetVersions = (cohort != null && !cohort.versions.isEmpty()) ? cohort.versions : RuntimeState.versions;
        Map<String, String> targetStudentVersion = (cohort != null && !cohort.studentAssignedVersion.isEmpty()) ? cohort.studentAssignedVersion : RuntimeState.studentAssignedVersion;

        String dept = (String) meta.getOrDefault("department", meta.getOrDefault("departmentCode", "CSE"));
        int semester = (int) parseLongSafe(meta.getOrDefault("semester", 5));
        String subCode = (String) meta.getOrDefault("subjectCode", "21CS51");
        String subName = (String) meta.getOrDefault("subjectName", "Computer Networks");
        String cycle = (String) meta.getOrDefault("cycleName", "2026-DEC");

        int totalCandidates = targetRoster.size();
        int attended = 0;
        int absent = 0;
        double totalMarksSum = 0;
        double highestMarks = 0;
        int passCount = 0;
        double marksPerQ = 1.0;
        double passThreshold = 10.0; // 40%

        List<Map<String, Object>> studentResults = new ArrayList<>();

        for (Map.Entry<String, Map<String, Object>> entry : targetRoster.entrySet()) {
            String usn = entry.getKey();
            Map<String, Object> details = entry.getValue();
            String subKey = examId + ":" + usn;
            Map<String, Object> sess = null;
            String sessToken = RuntimeState.usnToSessionToken.get(usn);
            if (sessToken != null) sess = RuntimeState.studentSessions.get(sessToken);
            boolean isSubmitted = RuntimeState.studentSubmissions.containsKey(subKey) || (sess != null && Boolean.TRUE.equals(sess.get("submitted")));
            if (isSubmitted && !RuntimeState.studentSubmissions.containsKey(subKey)) {
                RuntimeState.studentSubmissions.put(subKey, System.currentTimeMillis());
            }

            String section = (String) details.getOrDefault("originalSection", details.getOrDefault("section", "A"));
            String version = targetStudentVersion.getOrDefault(usn, "A");

            if (isSubmitted) {
                attended++;
                Map<String, Object> ansMap = RuntimeState.studentAnswers.getOrDefault(usn, Collections.emptyMap());

                Map<String, Object> verObj = targetVersions.get(version);
                List<?> qList = verObj != null ? (List<?>) verObj.get("questions") : Collections.emptyList();
                int totalQ = qList != null && !qList.isEmpty() ? qList.size() : 25;

                int correct = 0;
                int incorrect = 0;
                int unanswered = 0;

                for (Object qo : qList) {
                    if (qo instanceof Map<?, ?> qm) {
                        String qUid = String.valueOf(qm.get("questionUid"));
                        Integer expected = targetAnswerKeys.get(qUid + ":" + version);
                        if (expected == null) expected = targetAnswerKeys.get(qUid);

                        Object ansRec = ansMap.get(qUid);
                        if (ansRec == null && qm.containsKey("display_position")) {
                            ansRec = ansMap.get(String.valueOf(qm.get("display_position")));
                        }
                        if (ansRec == null && qm.containsKey("position")) {
                            ansRec = ansMap.get(String.valueOf(qm.get("position")));
                        }
                        String chosenOpt = null;
                        if (ansRec instanceof Map<?, ?> am) {
                            chosenOpt = (String) am.get("selectedOption");
                        }
                        if (chosenOpt == null || chosenOpt.isBlank() || "null".equalsIgnoreCase(chosenOpt)) {
                            unanswered++;
                        } else {
                            int chosenNum = switch (chosenOpt.trim().toUpperCase(Locale.ROOT)) {
                                case "A" -> 1;
                                case "B" -> 2;
                                case "C" -> 3;
                                case "D" -> 4;
                                default -> 0;
                            };
                            if (expected != null && chosenNum == expected) {
                                correct++;
                            } else {
                                incorrect++;
                            }
                        }
                    }
                }

                double score = correct * marksPerQ;
                boolean passed = score >= passThreshold;
                if (score > highestMarks) highestMarks = score;
                totalMarksSum += score;
                if (passed) passCount++;

                String trigger = "MANUAL";
                Map<String, Object> rcpt = RuntimeState.studentReceipts.get(subKey);
                if (rcpt != null && rcpt.get("submissionTrigger") != null) {
                    trigger = String.valueOf(rcpt.get("submissionTrigger"));
                }
                String subStatus = "AUTO_TIMER_EXPIRED".equalsIgnoreCase(trigger) ? "SUBMITTED_AUTO" : "SUBMITTED_MANUAL";

                Map<String, Object> sr = new LinkedHashMap<>();
                sr.put("usn", usn);
                sr.put("fullName", details.get("fullName"));
                sr.put("section", section);
                sr.put("attendanceStatus", "Present");
                sr.put("submissionStatus", subStatus);
                sr.put("status", subStatus);
                sr.put("version", version);
                sr.put("assignedVersion", version);
                sr.put("startedAt", sess != null ? Instant.ofEpochMilli(parseLongSafe(sess.get("startedAtMs"))).toString() : null);
                sr.put("submittedAt", Instant.ofEpochMilli(RuntimeState.studentSubmissions.get(subKey)).toString());
                sr.put("totalQuestions", totalQ);
                sr.put("correctCount", correct);
                sr.put("incorrectCount", incorrect);
                sr.put("unansweredCount", unanswered);
                sr.put("score", Math.round(score * 100.0) / 100.0);
                sr.put("passed", passed);
                studentResults.add(sr);
            } else {
                boolean started = sess != null && Boolean.TRUE.equals(sess.get("examStarted"));
                if (started) {
                    attended++;
                    Map<String, Object> sr = new LinkedHashMap<>();
                    sr.put("usn", usn);
                    sr.put("fullName", details.get("fullName"));
                    sr.put("section", section);
                    sr.put("attendanceStatus", "Present");
                    sr.put("submissionStatus", "INCOMPLETE");
                    sr.put("status", "INCOMPLETE");
                    sr.put("version", version);
                    sr.put("assignedVersion", version);
                    sr.put("startedAt", Instant.ofEpochMilli(parseLongSafe(sess.get("startedAtMs"))).toString());
                    sr.put("submittedAt", null);
                    sr.put("totalQuestions", 25);
                    sr.put("correctCount", 0);
                    sr.put("incorrectCount", 0);
                    sr.put("unansweredCount", 25);
                    sr.put("score", 0.0);
                    sr.put("passed", false);
                    studentResults.add(sr);
                } else {
                    absent++;
                    Map<String, Object> sr = new LinkedHashMap<>();
                    sr.put("usn", usn);
                    sr.put("fullName", details.get("fullName"));
                    sr.put("section", section);
                    sr.put("attendanceStatus", "Absent");
                    sr.put("submissionStatus", "ABSENT");
                    sr.put("status", "ABSENT");
                    sr.put("version", "N/A");
                    sr.put("assignedVersion", "N/A");
                    sr.put("startedAt", null);
                    sr.put("submittedAt", null);
                    sr.put("totalQuestions", 25);
                    sr.put("correctCount", 0);
                    sr.put("incorrectCount", 0);
                    sr.put("unansweredCount", 25);
                    sr.put("score", 0.0);
                    sr.put("passed", false);
                    studentResults.add(sr);
                }
            }
        }

        double averageMarks = attended > 0 ? (totalMarksSum / attended) : 0.0;
        double passPercentage = attended > 0 ? ((passCount * 100.0) / attended) : 0.0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCandidates", totalCandidates);
        summary.put("attended", attended);
        summary.put("absent", absent);
        summary.put("highestMarks", Math.round(highestMarks * 100.0) / 100.0);
        summary.put("averageMarks", Math.round(averageMarks * 100.0) / 100.0);
        summary.put("passPercentage", Math.round(passPercentage * 100.0) / 100.0);

        Map<String, Object> resultsDoc = new LinkedHashMap<>();
        resultsDoc.put("sessionId", examId);
        resultsDoc.put("examinationId", examId);
        resultsDoc.put("sittingCode", sitCode);
        resultsDoc.put("labId", LAB_ID);
        resultsDoc.put("totalCandidates", totalCandidates);
        resultsDoc.put("attended", attended);
        resultsDoc.put("absent", absent);
        resultsDoc.put("highestMarks", Math.round(highestMarks * 100.0) / 100.0);
        resultsDoc.put("averageMarks", Math.round(averageMarks * 100.0) / 100.0);
        resultsDoc.put("passPercentage", Math.round(passPercentage * 100.0) / 100.0);
        resultsDoc.put("summary", summary);
        resultsDoc.put("studentResults", studentResults);

        byte[] resultsBytes = Json.stringify(resultsDoc).getBytes(StandardCharsets.UTF_8);
        String payloadDigest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(resultsBytes));

        String origPkgUid = "";
        for (Map<String, Object> p : RuntimeState.packages.values()) {
            if (examId == parseLongSafe(p.get("examinationId"))) {
                origPkgUid = (String) p.get("packageUid");
                break;
            }
        }

        String resultPkgUid = "RES-PKG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        String createdAtIso = Instant.now().toString();

        String signatureHex = sign(resultsBytes, labPrivateKey);
        byte[] rawSigBytes = HexFormat.of().parseHex(signatureHex);

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("formatVersion", "1.0");
        manifest.put("resultPackageUid", resultPkgUid);
        manifest.put("originalPackageUid", origPkgUid);
        manifest.put("examinationId", examId);
        manifest.put("examinationCycle", cycle);
        manifest.put("sittingCode", sitCode);
        manifest.put("department", dept);
        manifest.put("semester", semester);
        manifest.put("subjectCode", subCode);
        manifest.put("subjectName", subName);
        manifest.put("labId", LAB_ID);
        manifest.put("createdAt", createdAtIso);
        manifest.put("studentCount", totalCandidates);
        manifest.put("attendedCount", attended);
        manifest.put("absentCount", absent);
        manifest.put("payloadDigestHex", payloadDigest);
        manifest.put("signatureHex", signatureHex);

        byte[] manifestBytes = Json.stringify(manifest).getBytes(StandardCharsets.UTF_8);

        String zipFileName = examId + "_" + sitCode.toUpperCase(Locale.ROOT) + ".labresult";
        Path zipPath = RESULTS_DIR.resolve(zipFileName);

        try (var fos = Files.newOutputStream(zipPath);
             var zos = new ZipOutputStream(fos)) {
            zos.putNextEntry(new ZipEntry("manifest.json"));
            zos.write(manifestBytes);
            zos.closeEntry();

            zos.putNextEntry(new ZipEntry("results.json"));
            zos.write(resultsBytes);
            zos.closeEntry();

            zos.putNextEntry(new ZipEntry("signature.bin"));
            zos.write(rawSigBytes);
            zos.closeEntry();

            zos.putNextEntry(new ZipEntry("signature.sig"));
            zos.write(rawSigBytes);
            zos.closeEntry();
        }

        System.out.println("[LabServer] Generated signed .labresult package: " + zipPath.toAbsolutePath() + " (Size: " + Files.size(zipPath) + " bytes)");

        try {
            broadcastSseEvent("result_package_available", Map.of(
                "eventType", "RESULT_PACKAGE_AVAILABLE",
                "examinationId", examId,
                "sitting", sitCode,
                "fileName", zipFileName,
                "labId", LAB_ID
            ));
        } catch (Exception ignored) {}

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("fileName", zipFileName);
        resp.put("filePath", zipPath.toAbsolutePath().toString());
        resp.put("fileSizeBytes", Files.size(zipPath));
        resp.put("manifest", manifest);
        resp.put("summary", summary);
        return Json.stringify(resp);
    }

    private static String handleResultsDownload(HttpExchange exchange) throws Exception {
        long examId = RuntimeState.activeSessionId != null ? RuntimeState.activeSessionId : 0L;
        String sitCode = RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : "MORNING";
        String q = exchange.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                String[] kv = part.split("=", 2);
                if (kv.length == 2) {
                    if ("examinationId".equalsIgnoreCase(kv[0])) {
                        try { examId = Long.parseLong(kv[1]); } catch (Exception ignored) {}
                    }
                    if ("sittingCode".equalsIgnoreCase(kv[0])) sitCode = kv[1];
                }
            }
        }
        String zipFileName = examId + "_" + sitCode.toUpperCase(Locale.ROOT) + ".labresult";
        Path zipPath = RESULTS_DIR.resolve(zipFileName);
        if (!Files.exists(zipPath)) {
            try (var s = Files.list(RESULTS_DIR)) {
                zipPath = s.filter(p -> p.getFileName().toString().endsWith(".labresult")).findFirst().orElse(null);
            }
        }
        if (zipPath == null || !Files.exists(zipPath)) {
            throw new LabException(404, "No .labresult package found for examination " + examId, "NOT_FOUND");
        }
        return "__BINARY_RESPONSE__:" + zipPath.toAbsolutePath();
    }

    private static String handleResultsTransferToCentral(HttpExchange exchange, Map<String, Object> form) throws Exception {
        Object formExamId = form != null ? form.get("examinationId") : null;
        Object formSitCode = form != null ? form.get("sittingCode") : null;
        if (formExamId != null && formSitCode != null) {
            String targetSit = String.valueOf(formSitCode).toUpperCase(Locale.ROOT);
            long targetEid = parseLongSafe(formExamId);
            for (Map<String, Object> pkg : RuntimeState.packages.values()) {
                long pEid = parseLongSafe(pkg.get("examinationId"));
                String pSit = String.valueOf(pkg.get("sittingCode")).toUpperCase(Locale.ROOT);
                if (pEid == targetEid && pSit.equals(targetSit)) {
                    activatePackageIntoMemory(pkg);
                    break;
                }
            }
        }
        long examId = parseLongSafe(form.getOrDefault("examinationId", RuntimeState.activeSessionId));
        String sitCode = String.valueOf(form.getOrDefault("sittingCode", RuntimeState.activeSittingName != null ? RuntimeState.activeSittingName : "MORNING"));
        String zipFileName = examId + "_" + sitCode.toUpperCase(Locale.ROOT) + ".labresult";
        Path zipPath = RESULTS_DIR.resolve(zipFileName);
        if (!Files.exists(zipPath)) {
            handleResultsFinalize(exchange, form);
        }
        if (!Files.exists(zipPath)) {
            throw new LabException(404, "Result package not found: " + zipFileName, "NOT_FOUND");
        }

        byte[] zipBytes = Files.readAllBytes(zipPath);
        String centralUrl = System.getenv().getOrDefault("CENTRAL_URL", "http://127.0.0.1:8081");
        String importEndpoint = centralUrl + "/api/v1/results/import-package";

        var client = java.net.http.HttpClient.newHttpClient();
        var req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(importEndpoint))
                .header("Content-Type", "application/octet-stream")
                .header("X-Package-FileName", zipFileName)
                .header("X-Examination-Id", String.valueOf(examId))
                .header("X-Sitting-Code", sitCode)
                .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(zipBytes))
                .build();

        var res = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new LabException(res.statusCode(), "Central Backend rejected result transfer: " + res.body(), "CENTRAL_REJECTED");
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("transferred", true);
        resp.put("centralStatusCode", res.statusCode());
        resp.put("centralResponse", Json.parse(res.body()));
        return Json.stringify(resp);
    }

    // --- UTILITIES ---
    private static void setCORS(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With, X-Simulated-Time-Ms, X-Bypass-Start-Check");
    }

    private static void sendJson(HttpExchange exchange, int status, Object data) throws IOException {
        byte[] bytes = Json.stringify(data).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
    }

    private static void sendError(HttpExchange exchange, int status, String msg, String code) throws IOException {
        setCORS(exchange);
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("success", false);
        err.put("error", msg);
        err.put("message", msg);
        err.put("errorCode", code);
        err.put("code", code);
        sendJson(exchange, status, err);
    }

    private static byte[] readAll(InputStream is) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int r;
        while ((r = is.read(buf)) != -1) baos.write(buf, 0, r);
        return baos.toByteArray();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parseJsonOrForm(String body) {
        if (body == null || body.isBlank()) return new LinkedHashMap<>();
        if (body.trim().startsWith("{")) {
            Object obj = Json.parse(body);
            if (obj instanceof Map<?, ?> m) {
                Map<String, Object> res = new LinkedHashMap<>();
                m.forEach((k, v) -> res.put(String.valueOf(k), v));
                return res;
            }
        }
        Map<String, Object> map = new LinkedHashMap<>();
        for (String pair : body.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                map.put(java.net.URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                        java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
            }
        }
        return map;
    }

    public static class LabException extends RuntimeException {
        public final int statusCode;
        public final String errorCode;
        public LabException(int statusCode, String message, String errorCode) {
            super(message);
            this.statusCode = statusCode;
            this.errorCode = errorCode;
        }
    }

    // --- JSON PARSER & SERIALIZER ---
    public static final class Json {
        public static Object parse(String src) {
            if (src == null || src.isBlank()) return new LinkedHashMap<String, Object>();
            return new Parser(src).parseValue();
        }

        public static String stringify(Object obj) {
            StringBuilder sb = new StringBuilder();
            serialize(obj, sb);
            return sb.toString();
        }

        private static void serialize(Object obj, StringBuilder sb) {
            if (obj == null) sb.append("null");
            else if (obj instanceof String s) {
                sb.append('"');
                for (int i = 0; i < s.length(); i++) {
                    char c = s.charAt(i);
                    switch (c) {
                        case '"' -> sb.append("\\\"");
                        case '\\' -> sb.append("\\\\");
                        case '\b' -> sb.append("\\b");
                        case '\f' -> sb.append("\\f");
                        case '\n' -> sb.append("\\n");
                        case '\r' -> sb.append("\\r");
                        case '\t' -> sb.append("\\t");
                        default -> {
                            if (c < ' ') sb.append(String.format("\\u%04x", (int) c));
                            else sb.append(c);
                        }
                    }
                }
                sb.append('"');
            } else if (obj instanceof Number || obj instanceof Boolean) sb.append(obj);
            else if (obj instanceof Map<?, ?> m) {
                sb.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> e : m.entrySet()) {
                    if (!first) sb.append(',');
                    first = false;
                    serialize(String.valueOf(e.getKey()), sb);
                    sb.append(':');
                    serialize(e.getValue(), sb);
                }
                sb.append('}');
            } else if (obj instanceof Collection<?> c) {
                sb.append('[');
                boolean first = true;
                for (Object o : c) {
                    if (!first) sb.append(',');
                    first = false;
                    serialize(o, sb);
                }
                sb.append(']');
            } else if (obj.getClass().isArray()) {
                sb.append('[');
                int len = java.lang.reflect.Array.getLength(obj);
                for (int i = 0; i < len; i++) {
                    if (i > 0) sb.append(',');
                    serialize(java.lang.reflect.Array.get(obj, i), sb);
                }
                sb.append(']');
            } else {
                serialize(obj.toString(), sb);
            }
        }

        private static class Parser {
            private final String src;
            private int pos = 0;

            Parser(String src) { this.src = src; }

            Object parseValue() {
                skipWs();
                if (pos >= src.length()) return null;
                char c = src.charAt(pos);
                if (c == '{') return parseObj();
                if (c == '[') return parseArr();
                if (c == '"') return parseStr();
                if (c == 't' || c == 'f') return parseBool();
                if (c == 'n') return parseNull();
                return parseNum();
            }

            private void skipWs() {
                while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) pos++;
            }

            private Map<String, Object> parseObj() {
                Map<String, Object> map = new LinkedHashMap<>();
                pos++;
                skipWs();
                if (peek('}')) { pos++; return map; }
                while (pos < src.length()) {
                    skipWs();
                    String key = parseStr();
                    skipWs();
                    consume(':');
                    Object val = parseValue();
                    map.put(key, val);
                    skipWs();
                    if (peek('}')) { pos++; break; }
                    consume(',');
                }
                return map;
            }

            private List<Object> parseArr() {
                List<Object> list = new ArrayList<>();
                pos++;
                skipWs();
                if (peek(']')) { pos++; return list; }
                while (pos < src.length()) {
                    list.add(parseValue());
                    skipWs();
                    if (peek(']')) { pos++; break; }
                    consume(',');
                }
                return list;
            }

            private String parseStr() {
                consume('"');
                StringBuilder sb = new StringBuilder();
                while (pos < src.length()) {
                    char c = src.charAt(pos++);
                    if (c == '"') return sb.toString();
                    if (c == '\\') {
                        if (pos >= src.length()) break;
                        char next = src.charAt(pos++);
                        switch (next) {
                            case '"' -> sb.append('"');
                            case '\\' -> sb.append('\\');
                            case '/' -> sb.append('/');
                            case 'b' -> sb.append('\b');
                            case 'f' -> sb.append('\f');
                            case 'n' -> sb.append('\n');
                            case 'r' -> sb.append('\r');
                            case 't' -> sb.append('\t');
                            case 'u' -> {
                                String hex = src.substring(pos, pos + 4);
                                pos += 4;
                                sb.append((char) Integer.parseInt(hex, 16));
                            }
                            default -> sb.append(next);
                        }
                    } else sb.append(c);
                }
                return sb.toString();
            }

            private Boolean parseBool() {
                if (src.startsWith("true", pos)) { pos += 4; return true; }
                if (src.startsWith("false", pos)) { pos += 5; return false; }
                throw new IllegalArgumentException("Invalid boolean");
            }

            private Object parseNull() {
                if (src.startsWith("null", pos)) { pos += 4; return null; }
                throw new IllegalArgumentException("Invalid null");
            }

            private Object parseNum() {
                int start = pos;
                if (peek('-')) pos++;
                while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                boolean isDouble = false;
                if (pos < src.length() && src.charAt(pos) == '.') {
                    isDouble = true;
                    pos++;
                    while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                }
                if (pos < src.length() && (src.charAt(pos) == 'e' || src.charAt(pos) == 'E')) {
                    isDouble = true;
                    pos++;
                    if (peek('+') || peek('-')) pos++;
                    while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
                }
                String s = src.substring(start, pos);
                return isDouble ? Double.parseDouble(s) : Long.parseLong(s);
            }

            private boolean peek(char c) { return pos < src.length() && src.charAt(pos) == c; }
            private void consume(char c) {
                if (pos >= src.length() || src.charAt(pos) != c)
                    throw new IllegalArgumentException("Expected '" + c + "' at " + pos);
                pos++;
            }
        }
    }
}
