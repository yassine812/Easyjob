"""Small DirectML graphs to stay within the integrated GPU's workload limits."""
from pathlib import Path
import gc
import numpy as np
import torch
import torch.nn.functional as F

def install(generator,size):
    import onnxruntime as ort
    ort.disable_telemetry_events()
    root=Path(__file__).resolve().parent/'runtime'/f'dml-split-{size}';root.mkdir(exist_ok=True)
    options=ort.SessionOptions();options.enable_mem_pattern=False
    options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL;options.intra_op_num_threads=2
    def session(path):
        return ort.InferenceSession(str(path),sess_options=options,providers=['DmlExecutionProvider','CPUExecutionProvider'])
    class Dense(torch.nn.Module):
        def __init__(self,net):super().__init__();self.net=net
        def forward(self,feature,driving,source):
            r=self.net(feature,{'value':driving},{'value':source})
            return r['mask'],r['deformation'],r['occlusion_map']
    h=size//4
    densepath=root/'dense.onnx'
    if not densepath.exists():
        print('Exporting motion network',flush=True)
        torch.onnx.export(Dense(generator.dense_motion_network),(torch.zeros(1,32,16,h,h),torch.zeros(1,15,3),torch.zeros(1,15,3)),str(densepath),input_names=['feature','driving','source'],output_names=['mask','deformation','occlusion_map'],opset_version=20,dynamo=False)
    class Stage(torch.nn.Module):
        def __init__(self,net,index):super().__init__();self.net=net;self.index=index
        def forward(self,x,features):
            if self.index==0:x=self.net.fc(features)
            if self.index<3:
                for i in range(self.index*2,self.index*2+2):x=getattr(self.net,'G_middle_'+str(i))(x,features)
            elif self.index==3:x=self.net.up_0(self.net.up(x),features)
            else:
                x=self.net.up_1(self.net.up(x),features)
                x=torch.sigmoid(self.net.conv_img(F.leaky_relu(x,.2)))
            return x
    paths=[]
    for i in range(5):
        path=root/f'decoder-{i}.onnx';paths.append(path)
        if not path.exists():
            print('Exporting decoder stage',i,flush=True)
            x=torch.zeros(1,256 if i==4 else 512,h*2 if i==4 else h,h*2 if i==4 else h)
            torch.onnx.export(Stage(generator.decoder,i),(x,torch.zeros(1,256,h,h)),str(path),input_names=['x','features'],output_names=['result'],opset_version=17,dynamo=False)
    print('Loading GPU motion network',flush=True)
    dense_session=session(densepath)
    print('Loading five small GPU decoder stages',flush=True)
    dec_sessions=[session(p) for p in paths]
    class DenseRuntime(torch.nn.Module):
        def forward(self,feature,kp_driving,kp_source):
            feed={'feature':np.ascontiguousarray(feature.cpu().numpy()),'driving':np.ascontiguousarray(kp_driving['value'].cpu().numpy()),'source':np.ascontiguousarray(kp_source['value'].cpu().numpy())}
            values=dense_session.run(None,feed)
            return {name:torch.from_numpy(value) for name,value in zip(['mask','deformation','occlusion_map'],values)}
    class DecoderRuntime(torch.nn.Module):
        def forward(self,features):
            seg=np.ascontiguousarray(features.cpu().numpy());x=np.zeros((1,512,h,h),np.float32)
            for s in dec_sessions:
                all_inputs={'x':x,'features':seg}
                x=s.run(None,{v.name:all_inputs[v.name] for v in s.get_inputs()})[0]
            return torch.from_numpy(x)
    generator.dense_motion_network=DenseRuntime();generator.decoder=DecoderRuntime()
    gc.collect();print('Split GPU renderer ready',flush=True)
