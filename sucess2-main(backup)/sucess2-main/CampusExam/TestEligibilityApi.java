import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class TestEligibilityApi {
    public static void main(String[] args) throws Exception {
        // Login as coe
        URL loginUrl = new URL("http://127.0.0.1:8081/api/v1/auth/login");
        HttpURLConnection lconn = (HttpURLConnection) loginUrl.openConnection();
        lconn.setRequestMethod("POST");
        lconn.setRequestProperty("Content-Type", "application/json");
        lconn.setDoOutput(true);
        lconn.getOutputStream().write("{\"username\":\"coe\",\"password\":\"COE@5828\"}".getBytes());
        String lresp = new String(lconn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int tokIdx = lresp.indexOf("\"token\":");
        int q1 = lresp.indexOf("\"", tokIdx + 8);
        int q2 = lresp.indexOf("\"", q1 + 1);
        String token = lresp.substring(q1 + 1, q2);

        URL url = new URL("http://127.0.0.1:8081/api/v1/institution/eligibility?department=E158CS&semester=8&sections=A");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "Bearer " + token);
        int code = conn.getResponseCode();
        InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String resp = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        System.out.println("HTTP " + code + ": " + resp);
    }
}
