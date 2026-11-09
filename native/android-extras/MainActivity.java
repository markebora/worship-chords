package app.disciples.worship;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderSavePlugin.class); // must come BEFORE super.onCreate
        super.onCreate(savedInstanceState);
    }
}
